import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, SectionList, Image,
    ActivityIndicator, TextInput, Alert, Pressable, Modal,
    BackHandler, Platform, Dimensions
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
        handleInstallPrompt
    } = usePWAInstall(myProfile?.id);

    // 4. 알림 동기화 관리
    const {
        requestNotificationPermission
    } = useNotificationSync({
        profileId: myProfile?.id,
        webPushToken,
        showToast,
        setLoading
    });

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

    const renderMailItem = ({ item }: { item: MailLog }) => (
        <MailItem
            item={item}
            onImagePress={(uri) => setSelectedMailImage(uri)}
            onMarkRead={(id) => setMails(prev => prev.map(m => m.id === id ? { ...m, read_at: new Date().toISOString() } : m))}
        />
    );

    // -----------------------------------------------------
    // 렌더링 시작
    // -----------------------------------------------------

    // 로딩 화면 (지점 정보가 없거나 인증 중일 때)
    if (identifying || !companyId) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={styles.loadingText}>우편함 데이터를 가져오는 중...</Text>
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
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={styles.title} numberOfLines={1}>
                            {(myProfile.company_name || myProfile.name) === myProfile.name
                                ? `${myProfile.name}님`
                                : `${myProfile.company_name} ${myProfile.name}님`}
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

            {/* [NEW] 공지사항 보드 - 최대 5개까지 한 줄씩 출력 */}
            {announcements.length > 0 && (
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

            {/* 탭 필터 + 새로고침 버튼 통합 */}
            <View style={styles.tabBarContainer}>
                <View style={[styles.tabButtons, { flex: 1 }]}>
                    <Pressable style={[styles.tabButton, filter === 'all' && styles.activeTab]} onPress={() => setFilter('all')}>
                        <Text style={[styles.tabText, filter === 'all' && styles.activeTabText]}>전체</Text>
                    </Pressable>
                    <Pressable style={[styles.tabButton, filter === 'unread' && styles.activeTab]} onPress={() => setFilter('unread')}>
                        <Text style={[styles.tabText, filter === 'unread' && styles.activeTabText]}>안읽음</Text>
                    </Pressable>

                    {/* [NEW] 우편물 전달 버튼 - 차별화된 디자인 */}
                    <Pressable
                        style={[styles.tabButton, styles.deliveryTabButton]}
                        onPress={() => setIsMailDeliveryVisible(true)}
                    >
                        <Ionicons name="paper-plane" size={14} color="#fff" />
                        <Text style={[styles.tabText, { color: '#fff', marginLeft: 4 }]}>우편물 전달</Text>
                    </Pressable>
                </View>

                <Pressable
                    onPress={() => refreshAnnouncements()}
                    style={styles.refreshButton}
                >
                    <Ionicons name="refresh" size={16} color="#4F46E5" />
                    <Text style={styles.refreshButtonText}>새로고침</Text>
                </Pressable>
            </View>

            {loading || mailsLoading ? (
                <ActivityIndicator style={{ marginTop: 50 }} color="#4F46E5" />
            ) : (
                <SectionList
                    sections={getGroupedMails(filter)}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMailItem}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>{title}</Text>
                        </View>
                    )}
                    stickySectionHeadersEnabled={false}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 50 }}>
                            <Text style={styles.emptyText}>
                                {filter === 'unread' ? '모두 확인하셨네요! 🎉' : '받은 우편물이 없습니다.'}
                            </Text>
                        </View>
                    }
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
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
                profileId={myProfile.id}
                initialName={myProfile.name}
                initialPhone={myProfile.phone}
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
    installBanner: {
        backgroundColor: '#EEF2FF',
        margin: 16,
        marginBottom: 0,
        padding: 16,
        borderRadius: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#C7D2FE',
    },
    installBannerTitle: { fontSize: 15, fontWeight: '800', color: '#4338CA', marginBottom: 2 },
    installBannerDesc: { fontSize: 12, color: '#6366F1' },
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
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F8FAFC',
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
});
