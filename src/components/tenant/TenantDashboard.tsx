import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image,
    ActivityIndicator, TextInput, Alert, Pressable, Modal,
    BackHandler, Platform, Dimensions, ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PrimaryButton } from '../common/PrimaryButton';
import { useToast } from '../../contexts/ToastContext';
import { SettingsModal } from './SettingsModal';
import { MailItem, MailLog } from './MailItem';
import { ReactNativeZoomableView } from '@openspacelabs/react-native-zoomable-view';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AnnouncementModal } from './AnnouncementModal';
import { DeliveryModal } from './DeliveryModal';

// Custom Hooks
import { useTenantAuth } from '../../hooks/tenant/useTenantAuth';
import { useMailLogs } from '../../hooks/tenant/useMailLogs';
import { usePWAInstall } from '../../hooks/tenant/usePWAInstall';
import { useNotificationSync } from '../../hooks/tenant/useNotificationSync';
import { useAnnouncements } from '../../hooks/tenant/useAnnouncements';

type Props = {
    companyId: string;
    companyName: string;
    pushToken?: string;
    webPushToken?: string;
    magicProfileId?: string;
    magicTenantId?: string;
    onBack: () => void;
};

export const TenantDashboard = ({
    companyId,
    companyName,
    pushToken,
    webPushToken,
    magicProfileId,
    magicTenantId,
    onBack
}: Props) => {
    const { showToast, playSound } = useToast();
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unread'>('all');
    const [selectedMailImage, setSelectedMailImage] = useState<string | null>(null);
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [isNoticeVisible, setIsNoticeVisible] = useState(false);
    const [isMailDeliveryVisible, setIsMailDeliveryVisible] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // 1. 인증 및 세션 관리
    const {
        name, setName,
        phoneSuffix, setPhoneSuffix,
        myProfile,
        myTenant,
        identifying,
        handleIdentify,
        handleLogout
    } = useTenantAuth({
        companyId,
        magicProfileId,
        magicTenantId,
        pushToken,
        webPushToken,
        showToast
    });

    // 2. 우편물 데이터 및 실시간 동기화
    const {
        mails,
        loading: mailsLoading,
        unreadCount,
        setMails,
        getGroupedMails
    } = useMailLogs({
        myProfileId: (!myTenant && myProfile && !myProfile.tenant_id) ? myProfile.id : undefined,
        myTenantId: myTenant ? myTenant.id : (myProfile?.tenant_id || (myProfile?.id && !myProfile.tenant_id ? undefined : myProfile?.id)),
        soundEnabled,
        playSound,
        showToast
    });

    // 3. PWA 설치 관리
    const {
        showInstallBanner,
        setShowInstallBanner,
        handleInstallPrompt,
        isIOS,
        isStandalone
    } = usePWAInstall(myProfile?.id);

    const [isIOSGuideVisible, setIsIOSGuideVisible] = useState(false);

    const onInstallPress = async () => {
        const result = await handleInstallPrompt();
        if (result === 'ios_guide') {
            setIsIOSGuideVisible(true);
        }
    };

    // 4. 알림 동기화 관리
    const {
        requestNotificationPermission
    } = useNotificationSync({
        profileId: myProfile?.id,
        webPushToken,
        showToast,
        setLoading
    });

    // [추가] 앱(스탠드얼론)으로 접속했을 때 알림 권한이 없으면 자동 요청
    useEffect(() => {
        if (isStandalone && myProfile?.id && !myProfile.web_push_token && !myProfile.push_token) {
            // 약간의 지연을 주어 화면이 뜬 후 팝업이 나오게 함
            const timer = setTimeout(() => {
                requestNotificationPermission();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isStandalone, myProfile?.id, myProfile?.web_push_token, myProfile?.push_token]);

    // 5. 공지사항 관리
    const { announcements, refreshAnnouncements } = useAnnouncements({
        companyId,
        tenantId: myProfile?.tenant_id || myProfile?.id
    });

    // 설정 로드 및 동기화
    useEffect(() => {
        AsyncStorage.getItem('soundEnabled').then(val => {
            if (val !== null) setSoundEnabled(val === 'true');
        });
    }, []);

    const toggleSound = async (val: boolean) => {
        setSoundEnabled(val);
        await AsyncStorage.setItem('soundEnabled', String(val));
    };

    // 하드웨어 뒤로가기 제어
    useEffect(() => {
        const backAction = () => {
            if (selectedMailImage) {
                setSelectedMailImage(null);
                return true;
            }
            if (myProfile) {
                handleLogout();
                return true;
            }
            onBack();
            return true;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [selectedMailImage, myProfile, onBack, companyId]);

    const flatData = React.useMemo(() => {
        const result: any[] = [];
        
        // 1. 헤더 (프로필, 공지사항 등)
        result.push({ type: 'header', id: 'header' });
        
        // 2. 컨트롤 (탭 바 - Sticky)
        result.push({ type: 'controls', id: 'controls' });
        
        // 3. 우편물 데이터
        const groups = getGroupedMails(filter) || [];
        if (groups.length === 0) {
            result.push({ type: 'empty', id: 'empty' });
        } else {
            groups.forEach((group, gIdx) => {
                result.push({ type: 'sectionHeader', title: group.title, id: `section-${gIdx}` });
                group.data.forEach(mail => {
                    result.push({ type: 'mail', mail, id: `mail-${mail.id}` });
                });
            });
        }
        
        return result;
    }, [getGroupedMails, filter]);

    const renderItem = React.useCallback(({ item }: any) => {
        if (item.type === 'header') {
            return (
                <View>
                    {/* PWA 설치 유도 배너 - 더욱 강조된 디자인 */}
                    {showInstallBanner && !isStandalone && (
                        <View style={styles.premiumInstallBanner}>
                            <View style={styles.installIconBox}>
                                <Ionicons name="notifications-circle" size={32} color="#4F46E5" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.installBannerTitle}>실시간 알림을 받으시겠습니까?</Text>
                                <Text style={styles.installBannerDesc}>앱으로 등록하면 우편물 도착 소식을 즉시 푸시 알림으로 보내드립니다.</Text>
                                <Pressable style={styles.premiumInstallButton} onPress={onInstallPress}>
                                    <Text style={styles.premiumInstallButtonText}>
                                        {isIOS ? '아이폰에 앱 추가하기 (10초)' : '포스트노티 앱 설치하기'}
                                    </Text>
                                </Pressable>
                            </View>
                            <Pressable style={styles.closeBannerBtn} onPress={() => setShowInstallBanner(false)}>
                                <Ionicons name="close" size={20} color="#94A3B8" />
                            </Pressable>
                        </View>
                    )}

                    <View style={styles.header}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text style={styles.title} numberOfLines={1}>
                                    {(() => {
                                        const cName = myProfile?.company_name || '';
                                        const pName = myProfile?.name || '';
                                        if (!cName && !pName) return '입주자님';
                                        if (cName === pName) return `${pName}님`;
                                        return `${cName} ${pName}님`.trim();
                                    })()}
                                </Text>
                                {unreadCount > 0 && (
                                    <View style={styles.unreadBadge}>
                                        <Text style={styles.unreadBadgeText}>+{unreadCount}</Text>
                                    </View>
                                )}
                                <Pressable onPress={() => setIsSettingsVisible(true)} style={{ marginLeft: 4 }}>
                                    <Ionicons name="settings-outline" size={20} color="#64748B" />
                                </Pressable>
                            </View>
                            <Text style={styles.subtitle}>{companyName} 스마트 우편함</Text>
                        </View>

                        <View style={{ alignItems: 'flex-end' }}>
                            <Pressable onPress={() => handleLogout()}>
                                <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 13 }}>로그아웃</Text>
                            </Pressable>
                        </View>
                    </View>

                    {/* 공지사항 보드 */}
                    {announcements && announcements.length > 0 && (
                        <View style={styles.noticeBoard}>
                            {announcements.slice(0, 5).map((notice, index) => (
                                <Pressable
                                    key={notice.id}
                                    onPress={() => setIsNoticeVisible(true)}
                                    style={[
                                        styles.noticeRow,
                                        index === 0 && { borderTopWidth: 0 }
                                    ]}
                                >
                                    <Text style={styles.noticeIconText}>📢</Text>
                                    <Text style={styles.noticeTitleText} numberOfLines={1}>
                                        {notice.title}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={14} color="#CBD5E1" />
                                </Pressable>
                            ))}
                        </View>
                    )}
                </View>
            );
        }

        if (item.type === 'controls') {
            return (
                <View style={styles.tabBarContainer}>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.tabButtons}
                    >
                        <Pressable style={[styles.tabButton, filter === 'all' && styles.activeTab]} onPress={() => setFilter('all')}>
                            <Text style={[styles.tabText, filter === 'all' && styles.activeTabText]}>전체</Text>
                        </Pressable>
                        <Pressable style={[styles.tabButton, filter === 'unread' && styles.activeTab]} onPress={() => setFilter('unread')}>
                            <Text style={[styles.tabText, filter === 'unread' && styles.activeTabText]}>안읽음</Text>
                        </Pressable>

                        <Pressable
                            style={[styles.tabButton, styles.deliveryTabButton]}
                            onPress={() => setIsMailDeliveryVisible(true)}
                        >
                            <Ionicons name="paper-plane" size={14} color="#fff" />
                            <Text style={[styles.tabText, { color: '#fff', marginLeft: 4 }]}>전달신청</Text>
                        </Pressable>
                    </ScrollView>

                    <Pressable
                        onPress={() => refreshAnnouncements()}
                        style={styles.iconRefreshButton}
                    >
                        <Ionicons name="refresh" size={18} color="#4F46E5" />
                    </Pressable>
                </View>
            );
        }

        if (item.type === 'sectionHeader') {
            return (
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{item.title}</Text>
                </View>
            );
        }

        if (item.type === 'empty') {
            return (
                <View style={{ alignItems: 'center', marginTop: 50 }}>
                    <Text style={styles.emptyText}>
                        {filter === 'unread' ? '모두 확인하셨네요! 🎉' : '받은 우편물이 없습니다.'}
                    </Text>
                </View>
            );
        }

        if (item.type === 'mail') {
            return (
                <MailItem
                    item={item.mail}
                    onImagePress={(uri) => setSelectedMailImage(uri)}
                    onMarkRead={(id) => setMails(prev => prev.map(m => m.id === id ? { ...m, read_at: new Date().toISOString() } : m))}
                />
            );
        }

        return null;
    }, [filter, showInstallBanner, isStandalone, myProfile, unreadCount, companyName, announcements, isIOS]);

    // -----------------------------------------------------
    // 렌더링 시작
    // -----------------------------------------------------

    // 로딩 화면 (지점 정보가 없거나 인증 중일 때)
    if (identifying || !companyId) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={styles.loadingText}>입주자 정보를 확인하고 있습니다...</Text>
                {!companyId && <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 10 }}>지점 데이터를 확인하고 있습니다...</Text>}
            </View>
        );
    }

    // 로그인 화면
    if (!myProfile) {
        return (
            <View style={styles.container}>
                <View style={styles.identifyBox}>
                    <View style={styles.premiumLoginCard}>
                        <View style={styles.loginHeader}>
                            <Text style={styles.welcomeSubtitle}>내 우편물 확인하기</Text>
                            <Text style={styles.welcomeTitle}>{companyName}</Text>
                        </View>

                        <View style={styles.formGroup}>
                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>입주사명 (상호명)</Text>
                                <TextInput
                                    style={styles.premiumInput}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="입주사 이름을 입력하세요"
                                    placeholderTextColor="#94A3B8"
                                    autoCorrect={false}
                                />
                            </View>

                            <View style={styles.inputContainer}>
                                <Text style={styles.inputLabel}>전화번호 뒷 4자리</Text>
                                <TextInput
                                    style={styles.premiumInput}
                                    value={phoneSuffix}
                                    onChangeText={setPhoneSuffix}
                                    placeholder="0000"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    secureTextEntry={true}
                                />
                            </View>

                            <PrimaryButton
                                label={identifying ? '확인 중...' : '우편물 조회 시작'}
                                onPress={() => handleIdentify()}
                                loading={identifying}
                                style={styles.premiumButton}
                                textStyle={{ fontSize: 16, fontWeight: '700' }}
                            />
                        </View>

                        <View style={styles.secureBadge}>
                            <Text style={{ fontSize: 13 }}>🔒</Text>
                            <Text style={styles.secureText}>안전하게 보호되고 있습니다</Text>
                        </View>
                    </View>
                </View>
            </View>
        );
    }

    // 메인 대시보드 화면
    return (
        <View style={styles.container}>
            {mailsLoading && mails.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4F46E5" />
                    <Text style={styles.loadingText}>우편물 데이터를 가져오는 중...</Text>
                </View>
            ) : (
                <FlatList
                    data={flatData}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    stickyHeaderIndices={[1]}
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            )}

            <SettingsModal
                visible={isSettingsVisible}
                soundEnabled={soundEnabled}
                onToggleSound={toggleSound}
                onClose={() => setIsSettingsVisible(false)}
            />

            <AnnouncementModal
                visible={isNoticeVisible}
                announcements={announcements}
                onClose={() => setIsNoticeVisible(false)}
            />

            <DeliveryModal
                visible={isMailDeliveryVisible}
                onClose={() => setIsMailDeliveryVisible(false)}
                companyId={companyId}
                profileId={myProfile?.id || ''}
                initialName={myProfile?.name || ''}
                initialPhone={myProfile?.phone || ''}
            />

            <Modal visible={!!selectedMailImage} transparent={true} animationType="fade" onRequestClose={() => setSelectedMailImage(null)}>
                <View style={styles.modalContainer}>
                    <Pressable style={styles.closeButton} onPress={() => setSelectedMailImage(null)}>
                        <Text style={styles.closeButtonText}>✕ 닫기</Text>
                    </Pressable>
                    <ReactNativeZoomableView maxZoom={5} minZoom={1} initialZoom={1} bindToBorders={true} style={styles.zoomWrapper}>
                        {selectedMailImage && <Image source={{ uri: selectedMailImage }} style={styles.modalImage} resizeMode="contain" />}
                    </ReactNativeZoomableView>
                    <View style={styles.zoomFooter}>
                        <Text style={styles.zoomFooterText}>💡 두 손가락으로 확대할 수 있습니다</Text>
                    </View>
                </View>
            </Modal>

            {/* iOS 전용 설치 가이드 모달 */}
            <Modal visible={isIOSGuideVisible} transparent={true} animationType="fade" onRequestClose={() => setIsIOSGuideVisible(false)}>
                <View style={[styles.modalContainer, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }]}>
                    <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 24, width: '85%', alignItems: 'center' }}>
                        <Text style={{ fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 16 }}>아이폰 앱 등록 방법 📲</Text>
                        
                        <View style={{ alignSelf: 'stretch', gap: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' }}>
                                    <Text style={{ color: '#fff', fontWeight: '800' }}>1</Text>
                                </View>
                                <Text style={{ fontSize: 15, color: '#475569' }}>하단 메뉴의 <Text style={{ fontWeight: '700', color: '#1E293B' }}>공유 버튼</Text>을 누릅니다.</Text>
                                <Ionicons name="share-outline" size={20} color="#4F46E5" />
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' }}>
                                    <Text style={{ color: '#fff', fontWeight: '800' }}>2</Text>
                                </View>
                                <Text style={{ fontSize: 15, color: '#475569' }}>리스트를 올려 <Text style={{ fontWeight: '700', color: '#1E293B' }}>홈 화면에 추가</Text>를 누릅니다.</Text>
                                <Ionicons name="add-circle-outline" size={20} color="#4F46E5" />
                            </View>
                        </View>

                        <Pressable 
                            style={{ marginTop: 32, backgroundColor: '#1E293B', paddingVertical: 14, paddingHorizontal: 40, borderRadius: 12 }}
                            onPress={() => setIsIOSGuideVisible(false)}
                        >
                            <Text style={{ color: '#fff', fontWeight: '700' }}>확인했습니다</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    loadingText: { marginTop: 12, color: '#64748B', fontSize: 14 },
    identifyBox: { padding: 24, flex: 1, justifyContent: 'center' },
    premiumLoginCard: { backgroundColor: '#fff', padding: 32, borderRadius: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.1, shadowRadius: 30, elevation: 10 },
    loginHeader: { marginBottom: 32, alignItems: 'center' },
    welcomeTitle: { fontSize: 26, fontWeight: '900', color: '#1E293B', textAlign: 'center' },
    welcomeSubtitle: { fontSize: 14, color: '#64748B', marginBottom: 8, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1 },
    formGroup: { gap: 20 },
    inputContainer: { gap: 8 },
    inputLabel: { fontSize: 13, fontWeight: '700', color: '#475467', marginLeft: 4 },
    premiumInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, padding: 18, fontSize: 16, color: '#1E293B' },
    premiumButton: { borderRadius: 16, height: 56, marginTop: 8, backgroundColor: '#4F46E5', shadowColor: '#4F46E5', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 8 },
    secureBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, gap: 6, opacity: 0.6 },
    secureText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
    header: { padding: 20, paddingTop: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
    subtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
    unreadBadge: { backgroundColor: '#EF4444', borderRadius: 12, paddingHorizontal: 6, paddingVertical: 2 },
    unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
    tabContainer: { flexDirection: 'row', padding: 16, gap: 10, backgroundColor: '#F8FAFC' },
    tabButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#E2E8F0' },
    activeTab: { backgroundColor: '#1E293B' },
    tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    activeTabText: { color: '#fff' },
    sectionHeader: { backgroundColor: '#F8FAFC', paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
    emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 15 },
    modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
    zoomWrapper: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
    modalImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.8 },
    closeButton: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
    closeButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    zoomFooter: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' },
    zoomFooterText: { color: '#fff', fontSize: 12, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
    premiumInstallBanner: {
        backgroundColor: '#fff',
        margin: 16,
        padding: 20,
        borderRadius: 24,
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#4F46E5',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 5,
    },
    installIconBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    installBannerTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
    installBannerDesc: { fontSize: 13, color: '#64748B', lineHeight: 18, marginBottom: 16 },
    premiumInstallButton: {
        backgroundColor: '#4F46E5',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 12,
        alignSelf: 'flex-start',
    },
    premiumInstallButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    closeBannerBtn: { padding: 4, marginLeft: 8 },
    installButton: {
        backgroundColor: '#4F46E5',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    installButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    noticeText: { fontSize: 13, color: '#475569', flex: 1 },

    // 컴팩트 공지사항 스타일
    compactNoticeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    compactNoticeLabel: { fontSize: 12, marginRight: 6 },
    compactNoticeTitle: { fontSize: 13, color: '#475569', fontWeight: '600', maxWidth: 180 },
    compactNoticeCount: { fontSize: 11, color: '#94A3B8', marginLeft: 6, fontWeight: '500' },

    // 새로고침 버튼 스타일
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    refreshButtonText: {
        fontSize: 12,
        color: '#4F46E5',
        fontWeight: '700',
        marginLeft: 4,
    },

    // 개선된 공지사항 영역
    noticeBoard: {
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginTop: -10, // 헤더와 살짝 겹치게 하여 연결성 강조
        borderRadius: 16,
        padding: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    noticeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderTopWidth: 1,
        borderTopColor: '#F8FAFC',
    },
    noticeIconText: { fontSize: 14, marginRight: 10 },
    noticeTitleText: { flex: 1, fontSize: 14, color: '#334155', fontWeight: '600' },

    // 탭 바 컨테이너 통합
    tabBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        gap: 12
    },
    tabButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    deliveryTabButton: {
        backgroundColor: '#4338CA',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        marginLeft: 4,
    },
    iconRefreshButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center'
    },
});
