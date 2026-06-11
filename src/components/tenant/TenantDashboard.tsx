import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, FlatList, Image,
    ActivityIndicator, TextInput, Alert, Pressable, Modal,
    BackHandler, Platform, Dimensions, ScrollView, Linking, Vibration, TouchableOpacity
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
import { TermsModal } from './TermsModal';
import { profilesService } from '../../services/profilesService';

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
    const [newMailAlert, setNewMailAlert] = useState<{sender: string; type: string; time: string} | null>(null);
    const [isInstallBannerDismissed, setIsInstallBannerDismissed] = useState(false);
    
    // 규정 동의 관련 상태 (최초 1회 팝업 및 배너 처리)
    const [localTermsAgreed, setLocalTermsAgreed] = useState<boolean | null>(null);
    const [isTermsModalVisible, setIsTermsModalVisible] = useState(false);
    const [isAutoLogin, setIsAutoLogin] = useState(true);

    const dismissInstallBanner = () => {
        setIsInstallBannerDismissed(true);
    };

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

    const handlePhoneChange = (text: string) => {
        let cleaned = text.replace(/[^0-9]/g, '');
        
        if (cleaned.length === 0) {
            setPhoneSuffix('');
            return;
        }

        // 항상 010으로 시작하도록 보정 (사용자가 010을 안치고 뒷자리만 치거나 붙여넣었을 때)
        if (!cleaned.startsWith('010') && cleaned.length > 0) {
            if (cleaned.startsWith('01') || cleaned.startsWith('0')) {
                // 사용자가 0, 01 을 치는 중이라면 그냥 둔다.
            } else {
                cleaned = '010' + cleaned;
            }
        }

        let formatted = '';
        if (cleaned.length <= 3) {
            formatted = cleaned;
        } else if (cleaned.length <= 7) {
            formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
        } else if (cleaned.length <= 10) {
            formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        } else {
            const truncated = cleaned.slice(0, 11);
            formatted = `${truncated.slice(0, 3)}-${truncated.slice(3, 7)}-${truncated.slice(7)}`;
        }
        setPhoneSuffix(formatted);
    };
    
    // 2. 우편물 데이터 및 실시간 동기화
    const {
        mails,
        loading: mailsLoading,
        unreadCount,
        setMails,
        loadMails,
        getGroupedMails
    } = useMailLogs({
        myProfileId: (!myTenant && myProfile && !myProfile.tenant_id) ? myProfile.id : undefined,
        myTenantId: myTenant ? myTenant.id : (myProfile?.tenant_id || (myProfile?.id && !myProfile.tenant_id ? undefined : myProfile?.id)),
        soundEnabled,
        playSound,
        showToast,
        onNewMailArrival: (info) => {
            try { Vibration.vibrate([0, 300, 200, 300]); } catch(e) {}
            setNewMailAlert(info);
        }
    });

    // 3. PWA 설치 관리
    const {
        showInstallBanner,
        setShowInstallBanner,
        handleInstallPrompt,
        isIOS,
        isStandalone,
        isInstallComplete,
        setIsInstallComplete
    } = usePWAInstall(myProfile?.profile_id || myProfile?.id);

    const [isIOSGuideVisible, setIsIOSGuideVisible] = useState(false);
    const [isAndroidGuideVisible, setIsAndroidGuideVisible] = useState(false);

    const onInstallPress = async () => {
        if (isIOS) {
            setIsIOSGuideVisible(true);
            return;
        }
        
        const result = await handleInstallPrompt();
        if (result !== 'accepted') {
            // 브라우저 자동 팝업이 안 뜰 경우 수동 가이드 표시
            setIsAndroidGuideVisible(true);
        }
    };

    // 4. 알림 동기화 관리
    const {
        requestNotificationPermission,
        permissionStatus
    } = useNotificationSync({
        profileId: myProfile?.profile_id || myProfile?.id,
        pushToken,
        webPushToken,
        showToast,
        setLoading
    });

    // [추가] 앱(스탠드얼론)으로 접속했을 때 알림 권한이 없으면 자동 요청
    useEffect(() => {
        if (isStandalone && (myProfile?.profile_id || myProfile?.id) && !myProfile.web_push_token && !myProfile.push_token) {
            // 약간의 지연을 주어 화면이 뜬 후 팝업이 나오게 함
            const timer = setTimeout(() => {
                requestNotificationPermission();
            }, 1500);
            return () => clearTimeout(timer);
        }
    }, [isStandalone, myProfile?.profile_id, myProfile?.id, myProfile?.web_push_token, myProfile?.push_token]);

    // 5. 공지사항 관리
    const { announcements, refreshAnnouncements } = useAnnouncements({
        companyId,
        tenantId: myProfile?.tenant_id || myProfile?.id
    });

    // 5. 브라우저 탭 제목(Title) 지점별 맞춤 설정
    useEffect(() => {
        if (Platform.OS === 'web') {
            const safeCompanyName = companyName || '포스트노티';
            const title = `${safeCompanyName} 스마트우편알림`;
            document.title = title;
            console.log(`[TenantDashboard] Setting title to: ${title}`);
        }
    }, [companyName]);

    // 설정 로드 및 동기화
    useEffect(() => {
        if (identifying) {
            setFilter('unread');
        }
    }, [identifying]);



    useEffect(() => {
        AsyncStorage.getItem('soundEnabled').then(val => {
            if (val !== null) setSoundEnabled(val === 'true');
        });
    }, []);

    const toggleSound = async (val: boolean) => {
        setSoundEnabled(val);
        await AsyncStorage.setItem('soundEnabled', String(val));
    };

    const downloadImage = async (uri: string) => {
        if (!uri) return;
        
        try {
            if (Platform.OS === 'web') {
                const response = await fetch(uri);
                const blob = await response.blob();
                const blobUrl = window.URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = `postnoti_${new Date().getTime()}.jpg`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(blobUrl);
                showToast({ message: '이미지를 다운로드했습니다.', type: 'success' });
            } else {
                Alert.alert('알림', '브라우저에서 열기 후 이미지를 길게 눌러 저장하실 수 있습니다.');
            }
        } catch (error) {
            console.error('Download error:', error);
            showToast({ message: '다운로드 중 오류가 발생했습니다.', type: 'error' });
        }
    };

    // 하드웨어 뒤로가기 제어 (Native & Web PWA 대응)
    const isManualBackRef = useRef(false);
    const modalsStateRef = useRef({
        selectedMailImage,
        isMailDeliveryVisible,
        isSettingsVisible,
        isNoticeVisible,
        isIOSGuideVisible,
        isAndroidGuideVisible,
        isInstallComplete
    });

    useEffect(() => {
        modalsStateRef.current = {
            selectedMailImage,
            isMailDeliveryVisible,
            isSettingsVisible,
            isNoticeVisible,
            isIOSGuideVisible,
            isAndroidGuideVisible,
            isInstallComplete
        };
    }, [selectedMailImage, isMailDeliveryVisible, isSettingsVisible, isNoticeVisible, isIOSGuideVisible, isAndroidGuideVisible, isInstallComplete]);

    useEffect(() => {
        const handleBack = () => {
            const state = modalsStateRef.current;
            
            // 1. 열려있는 팝업/모달이 있으면 해당 모달만 순차적으로 닫음
            if (state.selectedMailImage) {
                setSelectedMailImage(null);
                return true;
            }
            if (state.isMailDeliveryVisible) {
                setIsMailDeliveryVisible(false);
                return true;
            }
            if (state.isSettingsVisible) {
                setIsSettingsVisible(false);
                return true;
            }
            if (state.isNoticeVisible) {
                setIsNoticeVisible(false);
                return true;
            }
            if (state.isIOSGuideVisible) {
                setIsIOSGuideVisible(false);
                return true;
            }
            if (state.isAndroidGuideVisible) {
                setIsAndroidGuideVisible(false);
                return true;
            }
            if (state.isInstallComplete) {
                setIsInstallComplete(false);
                return true;
            }

            // 2. 메인 대시보드 상태일 때
            if (myProfile) {
                if (Platform.OS === 'web') {
                    const wantToExit = window.confirm('포스트노티 앱을 종료하시겠습니까?');
                    return !wantToExit; // 취소하면 true(기존 상태 유지), 종료하면 false(뒤로가기 허용)
                } else {
                    Alert.alert(
                        '앱 종료',
                        '포스트노티 앱을 종료하시겠습니까?',
                        [
                            { text: '취소', style: 'cancel' },
                            { text: '종료', onPress: () => BackHandler.exitApp() }
                        ],
                        { cancelable: true }
                    );
                    return true;
                }
            }

            // 로그인하지 않은 상태인 경우: Landing 화면으로 복귀
            onBack();
            return true;
        };

        if (Platform.OS === 'web') {
            if (!window.history.state || window.history.state.name !== 'home') {
                window.history.pushState({ name: 'home' }, '');
            }
            const popStateAction = (e: PopStateEvent) => {
                if (isManualBackRef.current) {
                    isManualBackRef.current = false;
                    return;
                }

                const appState = modalsStateRef.current;
                const hasModal = appState.selectedMailImage || appState.isMailDeliveryVisible || appState.isSettingsVisible || appState.isNoticeVisible || appState.isIOSGuideVisible || appState.isAndroidGuideVisible || appState.isInstallComplete;

                if (hasModal) {
                    setSelectedMailImage(null);
                    setIsMailDeliveryVisible(false);
                    setIsSettingsVisible(false);
                    setIsNoticeVisible(false);
                    setIsIOSGuideVisible(false);
                    setIsAndroidGuideVisible(false);
                    setIsInstallComplete(false);
                    // 이미 Home 상태로 되돌아왔으므로 추가 push 불필요
                } else {
                    const wantToExit = window.confirm('우편알림 앱을 종료하시겠습니까?');
                    if (!wantToExit) {
                        window.history.pushState({ name: 'home' }, '');
                    }
                }
            };
            window.addEventListener('popstate', popStateAction);
            return () => window.removeEventListener('popstate', popStateAction);
        } else {
            const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBack);
            return () => backHandler.remove();
        }
    }, [myProfile, onBack]);

    // 웹(PWA) 모달 열림 상태 동기화를 위한 History 스택 제어
    useEffect(() => {
        if (Platform.OS === 'web') {
            const hasModal = selectedMailImage || isMailDeliveryVisible || isSettingsVisible || isNoticeVisible || isIOSGuideVisible || isAndroidGuideVisible || isInstallComplete;
            if (hasModal) {
                window.history.pushState({ name: 'modal' }, '');
            } else {
                if (window.history.state && window.history.state.name === 'modal') {
                    isManualBackRef.current = true;
                    window.history.back();
                }
            }
        }
    }, [selectedMailImage, isMailDeliveryVisible, isSettingsVisible, isNoticeVisible, isIOSGuideVisible, isAndroidGuideVisible, isInstallComplete]);

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
                    {/* 우편물 규정 동의 거부 안내 배너 제거됨 */}

                    {/* 1. 알림 권한 거부 안내 배너 (앱 설치자 중 알림 꺼둔 사람용) */}
                    {isStandalone && permissionStatus === 'denied' && (
                        <View style={[styles.premiumInstallBanner, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                            <View style={[styles.installIconBox, { backgroundColor: '#FEF3C7' }]}>
                                <Ionicons name="notifications-off" size={32} color="#D97706" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.installBannerTitle, { color: '#92400E' }]}>알림이 꺼져 있습니다! 🔔</Text>
                                <Text style={styles.installBannerDesc}>우편물 도착 소식을 실시간으로 받으려면 브라우저 설정에서 알림을 허용해 주세요.</Text>
                                <Pressable 
                                    style={[styles.premiumInstallButton, { backgroundColor: '#D97706' }]} 
                                    onPress={() => {
                                        if (Platform.OS === 'web') {
                                            alert('📱 갤럭시(안드로이드) 알림 켜기:\n\n방법 1. 휴대폰 [설정] ➔ [애플리케이션] ➔ [포스트노티] ➔ [알림] ➔ [알림 허용] 켬\n\n방법 2. 일반 크롬(Chrome) 앱에서 postn.kr 접속 ➔ 주소창 왼쪽 🔒 터치 ➔ [알림] ➔ [허용]으로 변경\n\n🍎 아이폰(iOS) 알림 켜기:\n\n휴대폰 [설정] ➔ [알림] ➔ [포스트노티] ➔ [알림 허용] 켬');
                                        } else {
                                            Linking.openSettings();
                                        }
                                    }}
                                >
                                    <Text style={styles.premiumInstallButtonText}>설정 방법 보기</Text>
                                </Pressable>
                            </View>
                        </View>
                    )}

                    {/* 1.1 알림 권한 미정(default) 안내 배너 (웹/PWA 접속자 중 알림 비활성 상태) */}
                    {Platform.OS === 'web' && typeof Notification !== 'undefined' && permissionStatus === 'default' && (!isIOS || isStandalone) && (
                        <View style={[styles.premiumInstallBanner, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' }]}>
                            <View style={[styles.installIconBox, { backgroundColor: '#E0E7FF' }]}>
                                <Ionicons name="notifications" size={32} color="#4F46E5" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.installBannerTitle, { color: '#3730A3' }]}>실시간 알림을 받아보세요! 🔔</Text>
                                <Text style={styles.installBannerDesc}>우편물이 도착하면 실시간 푸시 알림으로 알려드립니다. 아래 버튼을 눌러 알림을 허용해 주세요.</Text>
                                <Pressable 
                                    style={[styles.premiumInstallButton, { backgroundColor: '#4F46E5' }]} 
                                    onPress={requestNotificationPermission}
                                >
                                    <Text style={styles.premiumInstallButtonText}>실시간 알림 켜기</Text>
                                </Pressable>
                            </View>
                        </View>
                    )}

                    {/* 1.5 새 우편물 도착 알림 배너 */}
                    {newMailAlert && (
                        <Pressable 
                            style={[styles.premiumInstallBanner, { backgroundColor: '#ECFDF5', borderColor: '#6EE7B7', borderWidth: 2 }]}
                            onPress={() => {
                                setNewMailAlert(null);
                                setFilter('unread');
                            }}
                        >
                            <View style={[styles.installIconBox, { backgroundColor: '#D1FAE5' }]}>
                                <Ionicons name="mail-unread" size={32} color="#059669" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.installBannerTitle, { color: '#065F46' }]}>📬 새 우편물이 도착했습니다!</Text>
                                <Text style={[styles.installBannerDesc, { color: '#047857' }]}>
                                    {newMailAlert.sender}에서 보낸 {newMailAlert.type} 우편물이 방금 접수되었습니다. ({newMailAlert.time})
                                </Text>
                                <View style={[styles.premiumInstallButton, { backgroundColor: '#059669', marginTop: 8 }]}>
                                    <Text style={styles.premiumInstallButtonText}>확인하기</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={styles.closeBannerBtn} hitSlop={{top: 20, bottom: 20, left: 20, right: 20}} onPress={(e) => { if(e && e.stopPropagation) e.stopPropagation(); setNewMailAlert(null); }}>
                                <View pointerEvents="none">
                                    <Ionicons name="close" size={24} color="#6EE7B7" />
                                </View>
                            </TouchableOpacity>
                        </Pressable>
                    )}

                    {/* 2. PWA 설치 유도 배너 (앱 미설치자 혹은 브라우저 접속 시 노출) */}
                    {showInstallBanner && !isStandalone && !isInstallBannerDismissed && (
                        <View style={styles.premiumInstallBanner}>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <Text style={styles.installBannerTitle}>우편알림 앱을 설치해주세요 📲</Text>
                                    <TouchableOpacity style={styles.closeBannerBtn} hitSlop={{top: 20, bottom: 20, left: 20, right: 20}} onPress={(e) => { if(e && e.stopPropagation) e.stopPropagation(); dismissInstallBanner(); }}>
                                        <View pointerEvents="none">
                                            <Ionicons name="close" size={24} color="#94A3B8" />
                                        </View>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.installBannerDesc}>우편알림은 전용앱을 통해서 알림됩니다.{'\n'}앱을 설치하시면 우편물 도착 시 실시간으로 알림을 받으실 수 있습니다.</Text>
                                {isIOS ? (
                                    <View style={{ marginTop: 10, gap: 8 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' }}>
                                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>1</Text>
                                            </View>
                                            <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}>하단의 <Text style={{ fontWeight: '800', color: '#4F46E5' }}>공유 버튼</Text> <Ionicons name="share-outline" size={14} color="#4F46E5" /> 을 누르세요</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' }}>
                                                <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>2</Text>
                                            </View>
                                            <Text style={{ fontSize: 13, color: '#334155', flex: 1 }}><Text style={{ fontWeight: '800', color: '#4F46E5' }}>[홈 화면에 추가]</Text> <Ionicons name="add-circle-outline" size={14} color="#4F46E5" /> 를 누르세요</Text>
                                        </View>
                                    </View>
                                ) : (
                                    <View style={{ flexDirection: 'column', gap: 8, marginTop: 10 }}>
                                        <Pressable 
                                            style={[styles.premiumInstallButton, { backgroundColor: '#4F46E5' }]} 
                                            onPress={() => {
                                                if (Platform.OS === 'web') {
                                                    window.location.href = `/download.html?branch=${encodeURIComponent(companyName || '')}`;
                                                }
                                            }}
                                        >
                                            <Text style={styles.premiumInstallButtonText}>
                                                안드로이드 전용 앱 다운로드
                                            </Text>
                                        </Pressable>
                                        <Pressable 
                                            style={[styles.premiumInstallButton, { backgroundColor: '#64748B' }]} 
                                            onPress={onInstallPress}
                                        >
                                            <Text style={styles.premiumInstallButtonText}>
                                                웹앱으로 설치하기
                                            </Text>
                                        </Pressable>
                                    </View>
                                )}
                            </View>
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
                            <Text style={[styles.tabText, { color: '#fff', marginLeft: 4 }]}>우편물 받기</Text>
                        </Pressable>
                    </ScrollView>

                    <Pressable
                        onPress={() => {
                            refreshAnnouncements();
                            loadMails();
                            showToast({ message: '우편함을 최신 상태로 동기화했습니다.', type: 'success' });
                        }}
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
    }, [filter, showInstallBanner, isInstallBannerDismissed, newMailAlert, isStandalone, myProfile, unreadCount, companyName, announcements, isIOS, permissionStatus]);

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
                                <Text style={styles.inputLabel}>등록된 휴대전화 번호</Text>
                                <TextInput
                                    style={styles.premiumInput}
                                    value={phoneSuffix}
                                    onChangeText={handlePhoneChange}
                                    placeholder="010-0000-0000"
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="number-pad"
                                    maxLength={13}
                                />
                            </View>

                            <Pressable 
                                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15, alignSelf: 'flex-start' }}
                                onPress={() => setIsAutoLogin(!isAutoLogin)}
                            >
                                <Ionicons 
                                    name={isAutoLogin ? "checkbox" : "square-outline"} 
                                    size={20} 
                                    color={isAutoLogin ? "#4F46E5" : "#94A3B8"} 
                                />
                                <Text style={{ marginLeft: 8, fontSize: 14, color: '#64748B', fontWeight: '500' }}>
                                    자동 로그인 유지
                                </Text>
                            </Pressable>

                            <PrimaryButton
                                label={identifying ? '확인 중...' : '우편물 조회 시작'}
                                onPress={() => handleIdentify(phoneSuffix, isAutoLogin)}
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
                    extraData={{ isInstallBannerDismissed, showInstallBanner, newMailAlert, permissionStatus, mails }}
                    keyExtractor={(item) => item.id + (item.mail?.read_at ? '_r' : '_u')}
                    renderItem={renderItem}
                    stickyHeaderIndices={[1]}
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            )}

            <SettingsModal
                visible={isSettingsVisible}
                soundEnabled={soundEnabled}
                permissionStatus={permissionStatus}
                onToggleSound={toggleSound}
                onRequestPermission={requestNotificationPermission}
                onShowTerms={() => setIsTermsModalVisible(true)}
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
                profileId={myProfile?.profile_id || myProfile?.id || ''}
                initialName={myProfile?.name || ''}
                initialPhone={myProfile?.phone || ''}
            />

            <TermsModal
                visible={isTermsModalVisible}
                onClose={() => setIsTermsModalVisible(false)}
            />

            <Modal visible={!!selectedMailImage} transparent={true} animationType="fade" onRequestClose={() => setSelectedMailImage(null)}>
                <View style={styles.modalContainer}>
                    <View style={styles.modalTopBar}>
                        <Pressable style={styles.modalActionBtn} onPress={() => downloadImage(selectedMailImage!)}>
                            <Ionicons name="download-outline" size={24} color="#fff" />
                            <Text style={styles.modalActionText}>저장</Text>
                        </Pressable>
                        <Pressable style={styles.modalActionBtn} onPress={() => setSelectedMailImage(null)}>
                            <Ionicons name="close" size={28} color="#fff" />
                        </Pressable>
                    </View>
                    
                    <ReactNativeZoomableView maxZoom={5} minZoom={1} initialZoom={1} bindToBorders={true} style={styles.zoomWrapper}>
                        {selectedMailImage && <Image source={{ uri: selectedMailImage }} style={styles.modalImage} resizeMode="contain" />}
                    </ReactNativeZoomableView>
                    
                    <View style={styles.zoomFooter}>
                        <Text style={styles.zoomFooterText}>💡 두 손가락으로 확대할 수 있습니다</Text>
                    </View>
                </View>
            </Modal>

            {/* 통합 설치 가이드 모달 */}
            <Modal visible={isIOSGuideVisible || isAndroidGuideVisible} transparent={true} animationType="fade" onRequestClose={() => { setIsIOSGuideVisible(false); setIsAndroidGuideVisible(false); }}>
                <View style={[styles.modalContainer, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.8)' }]}>
                    <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 28, width: '90%', maxWidth: 400 }}>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: '#1E293B', marginBottom: 8, textAlign: 'center' }}>
                            {isIOS ? '아이폰 앱 추가 방법 📲' : '안드로이드 앱 추가 방법 📲'}
                        </Text>
                        <Text style={{ fontSize: 14, color: '#64748B', marginBottom: 24, textAlign: 'center' }}>버튼 클릭으로 설치가 안 될 때 따라해 보세요!</Text>
                        
                        <View style={{ alignSelf: 'stretch', gap: 20 }}>
                            {isIOS ? (
                                <>
                                    <View style={styles.guideStep}>
                                        <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.stepTitle}>브라우저 하단의 <Text style={{ fontWeight: '800', color: '#4F46E5' }}>공유 버튼</Text>을 눌러주세요.</Text>
                                            <View style={{ flexDirection: 'row', marginTop: 4, gap: 8 }}>
                                                <Ionicons name="share-outline" size={24} color="#4F46E5" />
                                                <Text style={{ fontSize: 12, color: '#94A3B8' }}>(사각형에 화살표 모양)</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={styles.guideStep}>
                                        <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.stepTitle}>메뉴를 위로 올려 <Text style={{ fontWeight: '800', color: '#4F46E5' }}>[홈 화면에 추가]</Text>를 눌러주세요.</Text>
                                            <Ionicons name="add-circle-outline" size={24} color="#4F46E5" style={{ marginTop: 4 }} />
                                        </View>
                                    </View>
                                </>
                            ) : (
                                <>
                                    <View style={styles.guideStep}>
                                        <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.stepTitle}>화면 상단 주소창 옆의 <Text style={{ fontWeight: '800', color: '#4F46E5' }}>다운로드(⬇️) 버튼</Text>을 눌러주세요.</Text>
                                        </View>
                                    </View>
                                    <View style={{ marginVertical: 8, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 13, color: '#94A3B8', fontWeight: '700' }}>--- 또는 ---</Text>
                                    </View>
                                    <View style={styles.guideStep}>
                                        <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.stepTitle}>우측 상단 혹은 하단의 <Text style={{ fontWeight: '800', color: '#4F46E5' }}>메뉴 버튼</Text>을 눌러주세요.</Text>
                                            <View style={{ flexDirection: 'row', marginTop: 4, gap: 8, alignItems: 'center' }}>
                                                <Ionicons name="ellipsis-vertical" size={20} color="#4F46E5" />
                                                <Ionicons name="menu" size={20} color="#4F46E5" />
                                                <Text style={{ fontSize: 12, color: '#94A3B8' }}>(점 3개 혹은 가로줄 3개)</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={styles.guideStep}>
                                        <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.stepTitle}><Text style={{ fontWeight: '800', color: '#4F46E5' }}>[앱 설치]</Text> 또는 <Text style={{ fontWeight: '800', color: '#4F46E5' }}>[홈 화면에 추가]</Text>를 눌러주세요.</Text>
                                        </View>
                                    </View>
                                </>
                            )}
                        </View>

                        <Pressable 
                            style={{ marginTop: 32, backgroundColor: '#1E293B', paddingVertical: 16, borderRadius: 16, alignItems: 'center' }}
                            onPress={() => { setIsIOSGuideVisible(false); setIsAndroidGuideVisible(false); }}
                        >
                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 16 }}>확인했습니다</Text>
                        </Pressable>
                    </View>
                </View>
            </Modal>

            {/* [신규] 앱 설치 완료 후 강제 이동 모달 */}
            <Modal visible={isInstallComplete} transparent={true} animationType="fade">
                <View style={[styles.modalContainer, { justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(79, 70, 229, 0.95)' }]}>
                    <View style={{ backgroundColor: '#fff', padding: 32, borderRadius: 28, width: '85%', maxWidth: 400, alignItems: 'center' }}>
                        <Ionicons name="checkmark-circle" size={80} color="#10B981" style={{ marginBottom: 16 }} />
                        <Text style={{ fontSize: 24, fontWeight: '900', color: '#1E293B', marginBottom: 12, textAlign: 'center' }}>
                            설치가 완료되었습니다! 🎉
                        </Text>
                        <Text style={{ fontSize: 16, color: '#475569', textAlign: 'center', lineHeight: 24 }}>
                            현재 창(브라우저)은 닫으셔도 됩니다.{'\n'}
                            이제 홈 화면(바탕화면)에 생성된{'\n'}
                            <Text style={{ fontWeight: '800', color: '#4F46E5' }}>[우편알림]</Text> 앱 아이콘을 눌러주세요!
                        </Text>
                        <Pressable 
                            style={{ marginTop: 24, backgroundColor: '#F1F5F9', paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12 }}
                            onPress={() => setIsInstallComplete(false)}
                        >
                            <Text style={{ color: '#64748B', fontWeight: '700' }}>닫기</Text>
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
    header: { padding: 20, paddingTop: 48, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
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
    modalTopBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 10,
        zIndex: 10,
    },
    modalActionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    modalActionText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    zoomWrapper: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
    modalImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.7 },
    closeButton: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
    closeButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    zoomFooter: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' },
    zoomFooterText: { color: '#fff', fontSize: 12, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
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

    // 가이드 스텝 스타일
    guideStep: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
    stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
    stepNumberText: { color: '#fff', fontWeight: '900', fontSize: 14 },
    stepTitle: { fontSize: 15, color: '#334155', lineHeight: 22, fontWeight: '500' },

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
