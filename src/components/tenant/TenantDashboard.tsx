import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, SectionList, Image,
    ActivityIndicator, TextInput, Alert, Pressable, Modal,
    SafeAreaView, TouchableWithoutFeedback, BackHandler, ScrollView,
    Dimensions, Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import { supabase } from '../../lib/supabase';
import { mailService } from '../../services/mailService';
import { profilesService, Profile } from '../../services/profilesService';
import { tenantsService, Tenant } from '../../services/tenantsService';
import { PrimaryButton } from '../common/PrimaryButton';
import { messaging, getToken, VAPID_KEY } from '../../lib/firebase';
import { Platform } from 'react-native';
import { useToast } from '../../contexts/ToastContext';
import { SettingsModal } from './SettingsModal';
import { MailItem, MailLog } from './MailItem';

type Props = {
    companyId: string;
    companyName: string;
    pushToken?: string;
    webPushToken?: string;
    magicProfileId?: string; // Legacy: profile_id
    magicTenantId?: string;  // New: tenant_id (SaaS)
    onBack: () => void;
};

export const TenantDashboard = ({ companyId, companyName, pushToken, webPushToken, magicProfileId, magicTenantId, onBack }: Props) => {
    const [name, setName] = useState('');
    const [phoneSuffix, setPhoneSuffix] = useState('');
    const [myProfile, setMyProfile] = useState<any | null>(null); // Profile or Tenant
    const [myTenant, setMyTenant] = useState<Tenant | null>(null);
    const [mails, setMails] = useState<MailLog[]>([]);
    const [loading, setLoading] = useState(false);
    const [identifying, setIdentifying] = useState(false);

    // PWA Install State
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallBanner, setShowInstallBanner] = useState(false);

    const [selectedMailImage, setSelectedMailImage] = useState<string | null>(null);
    const [zoomScale, setZoomScale] = useState(1); // Zoom scale state
    const [filter, setFilter] = useState<'all' | 'unread'>('all'); // 필터 상태
    const { showToast, playSound } = useToast();
    const [isSettingsVisible, setIsSettingsVisible] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(true);

    // 설정 로드
    useEffect(() => {
        AsyncStorage.getItem('soundEnabled').then(val => {
            if (val !== null) setSoundEnabled(val === 'true');
        });
    }, []);

    // 설정 저장
    const toggleSound = async (val: boolean) => {
        setSoundEnabled(val);
        await AsyncStorage.setItem('soundEnabled', String(val));
    };

    // 실시간 구독 (새 우편물 알림)
    useEffect(() => {
        if (!myProfile?.id && !myTenant?.id) return;

        const targetId = myTenant?.id || myProfile?.id;
        const filterColumn = myTenant ? 'tenant_id' : 'profile_id';

        const channel = supabase
            .channel('public:mail_logs') // 'mails' -> 'mail_logs'
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'mail_logs',
                    filter: `${filterColumn}=eq.${targetId}`,
                },
                (payload) => {
                    // 새 우편물이 오면 리스트 갱신 및 알림음
                    if (soundEnabled) playSound();
                    setMails(prev => [payload.new as MailLog, ...prev]);
                    showToast({ message: '📬 방금 새로운 우편물이 도착했습니다!', type: 'success' });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [myProfile?.id, myTenant?.id]);


    // 자동 로그인 확인
    useEffect(() => {
        const checkAutoLogin = async () => {
            // Priority 1: Magic Link (Deep Link)
            // magicTenantId(SaaS) 우선, 없으면 magicProfileId(Legacy)
            const targetMagicId = magicTenantId || magicProfileId;
            if (targetMagicId) {
                try {
                    setIdentifying(true);

                    if (magicTenantId) {
                        // SaaS Tenant ID로 조회
                        const tenant = await tenantsService.getTenantById(magicTenantId);
                        if (tenant) {
                            setMyTenant(tenant);
                            setMyProfile(tenant); // UI 호환성을 위해 profile로도 설정
                            loadMails(undefined, tenant.id);
                            return;
                        }
                    } else if (magicProfileId) {
                        // Legacy Profile ID로 조회
                        const profile = await profilesService.getProfileById(magicProfileId);
                        if (profile) {
                            setMyProfile(profile);
                            loadMails(profile.id!);
                            return;
                        }
                    }
                } catch (e) {
                    console.log('Magic login failed', e);
                } finally {
                    setIdentifying(false);
                }
            }

            // Priority 2: Stored Credentials
            try {
                const storedName = await AsyncStorage.getItem(`tenant_name_${companyId}`);
                const storedPhone = await AsyncStorage.getItem(`tenant_phone_${companyId}`);

                if (storedName && storedPhone) {
                    setName(storedName);
                    setPhoneSuffix(storedPhone);
                    // 자동 로그인 시도
                    handleIdentify(storedName, storedPhone);
                }
            } catch (e) {
                console.log('Auto login failed', e);
            }
        };
        checkAutoLogin();
    }, [companyId, magicProfileId]);

    // PWA Installation Handling
    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallBanner(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        const installedHandler = async () => {
            console.log('PWA was installed');
            setShowInstallBanner(false);
            if (myProfile?.id) {
                await profilesService.updateProfile(myProfile.id, { pwa_installed: true });
            }
        };
        window.addEventListener('appinstalled', installedHandler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installedHandler);
        };
    }, [myProfile?.id]);

    // Web Push Sync Effect
    useEffect(() => {
        if (myProfile?.id && webPushToken) {
            profilesService.updateProfile(myProfile.id, { web_push_token: webPushToken });
        }
    }, [myProfile?.id, webPushToken]);

    const handleInstallPrompt = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        setDeferredPrompt(null);
        setShowInstallBanner(false);
    };

    // 뒤로가기 핸들러
    useEffect(() => {
        const backAction = () => {
            if (selectedMailImage) {
                setSelectedMailImage(null);
                return true;
            }
            if (myProfile) {
                // 로그아웃 대신 앱 종료 방지? 아니면 그냥 뒤로가기?
                // 여기서 뒤로가면 랜딩으로 가는데, 자동로그인이 되어있으면 다시 바로 로그인될 수 있음.
                // 일단 로그아웃 확인을 받거나 해야하지만, 여기선 프로필 해제만.
                Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
                    { text: '취소', style: 'cancel' },
                    {
                        text: '로그아웃',
                        onPress: async () => {
                            setMyProfile(null);
                            await AsyncStorage.removeItem(`tenant_name_${companyId}`);
                            await AsyncStorage.removeItem(`tenant_phone_${companyId}`);
                        }
                    }
                ]);
                return true;
            }
            onBack();
            return true;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [selectedMailImage, myProfile, onBack, companyId]);

    // 본인 확인
    const handleIdentify = async (inputName?: string, inputPhone?: string) => {
        const targetName = inputName || name;
        const targetPhone = inputPhone || phoneSuffix;

        if (!targetName.trim()) {
            showToast({ message: '입주사 명칭을 입력해주세요.', type: 'error' });
            return;
        }
        if (targetPhone.length !== 4) {
            showToast({ message: '전화번호 뒷자리 4자리를 정확히 입력해주세요.', type: 'error' });
            return;
        }

        setIdentifying(true);
        try {
            const profile = await profilesService.getTenantProfile(companyId, targetName.trim(), targetPhone);
            if (!profile) {
                if (!inputName) showToast({ message: '입주사 정보가 일치하지 않습니다.', type: 'error' });
                return;
            }
            if (profile.id && pushToken) {
                await profilesService.updateProfile(profile.id, { push_token: pushToken });
            }
            if (profile.id && webPushToken) {
                await profilesService.updateProfile(profile.id, { web_push_token: webPushToken });
            }

            // 로그인 성공 시 저장
            await AsyncStorage.setItem(`tenant_name_${companyId}`, targetName.trim());
            await AsyncStorage.setItem(`tenant_phone_${companyId}`, targetPhone);

            setMyProfile(profile);
            setMyTenant(null);
            loadMails(profile.id!);
        } catch (err) {
            showToast({ message: '조회 중 문제가 발생했습니다.', type: 'error' });
        } finally {
            setIdentifying(false);
        }
    };

    const loadMails = async (profileId?: string, tenantId?: string) => {
        console.log('--- [TenantDashboard] Loading Mails for:', { profileId, tenantId });
        setLoading(true);
        try {
            let data: any[] = [];
            if (tenantId) {
                data = await mailService.getMailsByTenant(tenantId);
            } else if (profileId) {
                data = await mailService.getMailsByProfile(profileId);
            }
            console.log('--- [TenantDashboard] Mails fetched:', data?.length || 0);
            setMails(data || []);
        } catch (err) {
            console.error('--- [TenantDashboard] Load Mails Error:', err);
        } finally {
            setLoading(false);
        }
    };

    const renderMailItem = ({ item }: { item: MailLog }) => (
        <MailItem
            item={item}
            onImagePress={(uri) => setSelectedMailImage(uri)}
            onMarkRead={(id) => setMails(prev => prev.map(m => m.id === id ? { ...m, read_at: new Date().toISOString() } : m))}
        />
    );

    if (!myProfile) {
        if (identifying && !name) {
            // 자동 로그인 시도 중일 때 로딩 표시 (name이 세팅되기 전 등)
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#4F46E5" />
                    <Text style={styles.loadingText}>자동 로그인 중...</Text>
                </View>
            );
        }

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
                                label="우편물 조회 시작"
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

    const handleLogout = async () => {
        const performLogout = async () => {
            try {
                await AsyncStorage.removeItem(`tenant_name_${companyId}`);
                await AsyncStorage.removeItem(`tenant_phone_${companyId}`);
                setMyProfile(null);
                setName('');
                setPhoneSuffix('');
            } catch (e) {
                console.error('Logout failed', e);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('로그아웃 하시겠습니까?')) {
                performLogout();
            }
        } else {
            Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
                { text: '취소', style: 'cancel' },
                {
                    text: '로그아웃',
                    style: 'destructive',
                    onPress: performLogout
                }
            ]);
        }
    };

    const requestNotificationPermission = async () => {
        if (Platform.OS !== 'web') return;

        // 브라우저 권한 객체 체크
        if (typeof Notification === 'undefined') {
            showToast({ message: '사파리 앱에서 "홈 화면에 추가"를 먼저 해주세요!', type: 'error' });
            return;
        }

        if (!messaging) {
            showToast({ message: '알림 엔진 준비 중... 인터넷 연결을 확인해주세요.', type: 'error' });
            return;
        }

        setLoading(true); // 로딩 표시 사용 (전체 로딩이나 별도 상태)
        try {
            console.log("Requesting permission...");
            const permission = await Notification.requestPermission();

            if (permission === 'granted') {
                const token = await getToken(messaging, { vapidKey: VAPID_KEY });

                if (token && myProfile?.id) {
                    await profilesService.updateProfile(myProfile.id, { web_push_token: token });
                    // 상태 업데이트를 통해 UI 즉시 반영 (리로드 제거)
                    showToast({ message: '알림 설정 완료! 새 우편물이 도착하면 알려드립니다.', type: 'success' });
                } else {
                    showToast({ message: '신분증(토큰)을 가져오지 못했습니다. 잠시 후 다시 시도해주세요.', type: 'error' });
                }
            } else if (permission === 'denied') {
                showToast({ message: '알림 권한이 차단되어 있습니다. 설정에서 알림을 켜주세요.', type: 'error' });
            }
        } catch (error: any) {
            console.error('Error:', error);
            showToast({ message: '설정 중 오류가 발생했습니다.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };


    // 우편물 그룹화 로직 (날짜별)
    const getGroupedMails = () => {
        if (!mails || mails.length === 0) {
            return [];
        }

        const filtered = mails.filter(mail => {
            if (filter === 'unread') return !mail.read_at;
            return true;
        });

        const groups: { [key: string]: any[] } = {};
        filtered.forEach(mail => {
            if (!mail.created_at) return;
            const d = new Date(mail.created_at);

            // iOS 호환성을 위해 toLocaleDateString 대신 수동 포맷팅 사용
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const date = d.getDate();
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const day = dayNames[d.getDay()];

            const dateStr = `${year}년 ${month}월 ${date}일 (${day})`;

            // 오늘/어제 비교용
            const now = new Date();
            const todayStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${dayNames[now.getDay()]})`;

            const yest = new Date(Date.now() - 86400000);
            const yestStr = `${yest.getFullYear()}년 ${yest.getMonth() + 1}월 ${yest.getDate()}일 (${dayNames[yest.getDay()]})`;

            let displayTitle = dateStr;
            if (dateStr === todayStr) displayTitle = `오늘 (${dateStr})`;
            else if (dateStr === yestStr) displayTitle = `어제 (${dateStr})`;

            if (!groups[displayTitle]) groups[displayTitle] = [];
            groups[displayTitle].push(mail);
        });

        return Object.keys(groups).map(title => ({
            title,
            data: groups[title]
        }));
    };

    const unreadCount = mails.filter(m => !m.read_at).length;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.title}>{myProfile.name}님</Text>
                        {unreadCount > 0 && (
                            <View style={styles.unreadBadge}>
                                <Text style={styles.unreadBadgeText}>+{unreadCount}</Text>
                            </View>
                        )}
                        <Pressable onPress={() => setIsSettingsVisible(true)} style={{ marginLeft: 4 }}>
                            <Text style={{ fontSize: 18 }}>⚙️</Text>
                        </Pressable>
                    </View>
                    <Text style={styles.subtitle}>{companyName} 우편함</Text>
                </View>
                <Pressable onPress={handleLogout}>
                    <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 13 }}>로그아웃</Text>
                </Pressable>
            </View>

            {/* 알림 권한 유도 배너 (토큰이 없을 때만 표시) */}
            {Platform.OS === 'web' && typeof Notification !== 'undefined' && Notification.permission !== 'granted' && !myProfile.web_push_token && (
                <View style={[styles.installBanner, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.installBannerTitle, { color: '#6D28D9' }]}>🔔 알림이 꺼져 있습니다</Text>
                        <Text style={[styles.installBannerDesc, { color: '#7C3AED' }]}>알림을 켜고 우편물 소식을 실시간으로 받으세요.</Text>
                    </View>
                    <Pressable
                        style={[styles.installButton, { backgroundColor: '#7C3AED' }]}
                        onPress={requestNotificationPermission}
                    >
                        <Text style={styles.installButtonText}>알림 켜기</Text>
                    </Pressable>
                </View>
            )}

            {/* PWA 설치 유도 배너 */}
            {showInstallBanner && (
                <View style={styles.installBanner}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.installBannerTitle}>📱 홈 화면에 앱 설치</Text>
                        <Text style={styles.installBannerDesc}>바탕화면에 앱을 만들어 더 편하게 사용하세요.</Text>
                    </View>
                    <Pressable style={styles.installButton} onPress={handleInstallPrompt}>
                        <Text style={styles.installButtonText}>설치하기</Text>
                    </Pressable>
                    <Pressable onPress={() => setShowInstallBanner(false)} style={{ marginLeft: 10 }}>
                        <Text style={{ fontSize: 16, color: '#94A3B8' }}>✕</Text>
                    </Pressable>
                </View>
            )}

            {/* iOS 전용 설치 가이드 (iOS는 beforeinstallprompt가 없으므로 수동 표시) */}
            {Platform.OS === 'web' && /iphone|ipad|ipod/i.test(navigator?.userAgent?.toLowerCase() || '') && !(window as any).matchMedia('(display-mode: standalone)').matches && (
                <View style={[styles.installBanner, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA' }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.installBannerTitle, { color: '#C2410C' }]}>🍏 아이폰 알림 받기</Text>
                        <Text style={[styles.installBannerDesc, { color: '#EA580C' }]}>
                            [공유] &gt; [홈 화면에 추가]를 눌러 앱을 설치해야 알림이 작동합니다.
                        </Text>
                    </View>
                    <View style={{ width: 10 }} />
                    <View style={{ backgroundColor: '#F97316', padding: 8, borderRadius: 10 }}>
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>가이드</Text>
                    </View>
                </View>
            )}

            {/* 탭 필터 (하단 알림 배너 중복 제거 및 로직 통합) */}
            {(Platform.OS === 'web' && typeof Notification !== 'undefined' && (Notification.permission === 'default' || Notification.permission === 'denied') && !myProfile.web_push_token) && (
                /* 위쪽 배너와 역할이 중복되므로, 상태에 따라 하나만 보여주거나 통합하는 것이 좋습니다. 
                   여기서는 상단 '🔔 알림이 꺼져 있습니다' 배너가 이미 있으므로 이 블록은 제거하거나, 
                   더 눈에 띄는 하단 플로팅으로 대체할 수 있습니다. 
                   사용자 경험상 위쪽 배너가 자연스러우므로 이 블록은 숨깁니다. 
                */
                null
            )}

            <View style={styles.tabContainer}>
                <Pressable
                    style={[styles.tabButton, filter === 'all' && styles.activeTab]}
                    onPress={() => setFilter('all')}
                >
                    <Text style={[styles.tabText, filter === 'all' && styles.activeTabText]}>전체 보기</Text>
                </Pressable>
                <Pressable
                    style={[styles.tabButton, filter === 'unread' && styles.activeTab]}
                    onPress={() => setFilter('unread')}
                >
                    <Text style={[styles.tabText, filter === 'unread' && styles.activeTabText]}>
                        안읽음 {unreadCount > 0 ? `(${unreadCount})` : ''}
                    </Text>
                </Pressable>
            </View>

            <SectionList
                sections={getGroupedMails()}
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

            {/* 설정 모달 */}
            <SettingsModal
                visible={isSettingsVisible}
                soundEnabled={soundEnabled}
                onToggleSound={toggleSound}
                onClose={() => setIsSettingsVisible(false)}
            />

            {/* 이미지 확대 모달 (개선됨: 모든 플랫폼 지원) */}
            <Modal
                visible={!!selectedMailImage}
                transparent={true}
                onShow={() => setZoomScale(1)}
                animationType="fade"
                onRequestClose={() => setSelectedMailImage(null)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.zoomHeader}>
                        <Pressable style={styles.zoomControlBtn} onPress={() => setZoomScale(prev => Math.max(1, prev - 0.5))}>
                            <Text style={styles.zoomControlText}>-</Text>
                        </Pressable>
                        <Text style={styles.zoomPercentText}>{Math.round(zoomScale * 100)}%</Text>
                        <Pressable style={styles.zoomControlBtn} onPress={() => setZoomScale(prev => Math.min(5, prev + 0.5))}>
                            <Text style={styles.zoomControlText}>+</Text>
                        </Pressable>
                        <View style={{ flex: 1 }} />
                        <Pressable style={styles.closeButton} onPress={() => setSelectedMailImage(null)}>
                            <Text style={styles.closeButtonText}>✕ 닫기</Text>
                        </Pressable>
                    </View>

                    <ScrollView
                        maximumZoomScale={5}
                        minimumZoomScale={1}
                        centerContent={true}
                        showsHorizontalScrollIndicator={false}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.zoomWrapper}
                    >
                        {selectedMailImage && (
                            <Image
                                source={{ uri: selectedMailImage }}
                                style={[
                                    styles.modalImage,
                                    { transform: [{ scale: zoomScale }] }
                                ]}
                                resizeMode="contain"
                            />
                        )}
                    </ScrollView>
                    <View style={styles.zoomFooter}>
                        <Text style={styles.zoomFooterText}>💡 상단 버튼이나 두 손가락으로 벌려 확대할 수 있습니다</Text>
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
    identifyBox: { padding: 24, flex: 1, justifyContent: 'center', backgroundColor: '#F8FAFC' },
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

    // 탭 스타일
    tabContainer: { flexDirection: 'row', padding: 16, gap: 10, backgroundColor: '#F8FAFC' },
    tabButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: '#E2E8F0' },
    activeTab: { backgroundColor: '#1E293B' },
    tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
    activeTabText: { color: '#fff' },

    mailItem: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    mailInfo: { flex: 1 },
    mailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    mailType: { fontSize: 14, fontWeight: '700', color: '#4F46E5', backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
    mailDate: { fontSize: 12, color: '#94A3B8' },
    mailContent: { fontSize: 15, color: '#334155', lineHeight: 22, marginBottom: 10 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 12, fontWeight: '700' },
    mailImage: { width: 90, height: 90, borderRadius: 12, backgroundColor: '#F1F5F9' },
    emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 15 },

    // 확대 모달 스타일
    modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
    zoomWrapper: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
    modalImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.8 },
    closeButton: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
    closeButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    zoomFooter: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' },
    zoomFooterText: { color: '#fff', fontSize: 12, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },

    // PWA 배너 스타일
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

    // 섹션 헤더 스타일
    sectionHeader: { backgroundColor: '#F8FAFC', paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },

    // 줌 헤더 스타일
    zoomHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, gap: 12, zIndex: 100 },
    zoomControlBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    zoomControlText: { color: '#fff', fontSize: 20, fontWeight: '700' },
    zoomPercentText: { color: '#fff', fontSize: 14, fontWeight: '600', width: 45, textAlign: 'center' },
});
