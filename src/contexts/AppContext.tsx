import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert, BackHandler, AppState } from 'react-native';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';
// Utils
import { registerForPushNotificationsAsync } from '../utils/notificationHelper';
import { messaging, getToken, VAPID_KEY } from '../lib/firebase';
import { Platform } from 'react-native';

// Services
import { companiesService, Company } from '../services/companiesService';
import { profilesService, Profile } from '../services/profilesService';
import { tenantsService, Tenant } from '../services/tenantsService';
import { mailService } from '../services/mailService';
import { storageService } from '../services/storageService';
import { masterSendersService } from '../services/masterSendersService';
import { recognizeText, MailType, classifyMail, preprocessImage as ocrPreprocess } from '../services/ocrService';


// Hooks
import { useOCR } from '../hooks/useOCR';
import { useMailRegistration } from '../hooks/useMailRegistration';

export type AppMode = 'landing' | 'admin_login' | 'admin_branch_select' | 'admin_dashboard' | 'admin_register_mail' | 'admin_notification_settings' | 'admin_settings' | 'admin_tenants' | 'admin_delivery' | 'admin_announcements' | 'admin_menu' | 'tenant_login' | 'tenant_dashboard';

interface AppContextType {
    // Global State
    mode: AppMode;
    setMode: (mode: AppMode) => void;
    isInitializing: boolean;
    expoPushToken: string;
    webPushToken: string;
    brandingCompany: Company | null;
    setBrandingCompany: (comp: Company | null) => void;
    magicIdResolved: boolean;

    // Admin Data
    officeInfo: Company | null;
    setOfficeInfo: (comp: Company | null) => void;
    profiles: Tenant[];
    setProfiles: (tenants: Tenant[]) => void;
    masterSenders: string[];
    setMasterSenders: (senders: string[]) => void;

    // UI Visibility States (Modals)
    isAdminMgmtVisible: boolean;
    setIsAdminMgmtVisible: (v: boolean) => void;
    isTenantMgmtVisible: boolean;
    setIsTenantMgmtVisible: (v: boolean) => void;
    isSenderMgmtVisible: boolean;
    setIsSenderMgmtVisible: (v: boolean) => void;
    isHistoryVisible: boolean;
    setIsHistoryVisible: (v: boolean) => void;
    isManualSearchVisible: boolean;
    setIsManualSearchVisible: (v: boolean) => void;

    // Other UI States
    selectedProfileForHistory: Tenant | null;
    setSelectedProfileForHistory: (p: Tenant | null) => void;
    manualSearchQuery: string;
    setManualSearchQuery: (q: string) => void;

    // OCR & Mail Registration State (Delegated to hooks)
    selectedImage: string | null;
    setSelectedImage: (uri: string | null) => void;
    ocrLoading: boolean;
    recognizedText: string;
    detectedMailType: MailType;
    setDetectedMailType: (t: MailType) => void;
    detectedSender: string;
    setDetectedSender: (s: string) => void;
    matchedProfile: Tenant | null;
    setMatchedProfile: (p: Tenant | null) => void;
    extraImages: string[];
    setExtraImages: (imgs: string[]) => void;



    // Tenant Data
    tenantProfile: any | null;
    setTenantProfile: (p: any | null) => void;

    // Actions
    loadData: () => Promise<void>;
    runOCR: (uri: string) => Promise<void>;
    handleRegisterMail: (
        tenant: Tenant | null,
        image: string | null,
        type: MailType,
        sender: string,
        extras: string[],
        customMsg?: string
    ) => Promise<any>;
    optimizeImage: (uri: string) => Promise<string>;
    handleLoginSuccess: (profile: any) => Promise<void>;
    resetOCR: () => void;
    pendingDeliveryCount: number;
    loadPendingDeliveryCount: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    // --- States ---
    const [mode, setMode] = useState<AppMode>('landing');
    const [brandingCompany, setBrandingCompany] = useState<Company | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [expoPushToken, setExpoPushToken] = useState('');
    const [webPushToken, setWebPushToken] = useState('');
    const [magicIdResolved, setMagicIdResolved] = useState(false);

    // Admin Data
    const [officeInfo, setOfficeInfo] = useState<Company | null>(null);
    const [profiles, setProfiles] = useState<Tenant[]>([]);
    const [masterSenders, setMasterSenders] = useState<string[]>([]);
    const [tenantProfile, setTenantProfile] = useState<any | null>(null);

    // UI Visibility
    const [isAdminMgmtVisible, setIsAdminMgmtVisible] = useState(false);
    const [isTenantMgmtVisible, setIsTenantMgmtVisible] = useState(false);
    const [isSenderMgmtVisible, setIsSenderMgmtVisible] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [isManualSearchVisible, setIsManualSearchVisible] = useState(false);

    // Search & Filters
    const [selectedProfileForHistory, setSelectedProfileForHistory] = useState<Tenant | null>(null);
    const [manualSearchQuery, setManualSearchQuery] = useState('');

    // --- Hooks (Modularized Logic) ---
    const {
        selectedImage, setSelectedImage,
        recognizedText,
        detectedMailType, setDetectedMailType,
        detectedSender, setDetectedSender,
        ocrLoading, setOcrLoading,
        extraImages, setExtraImages,
        matchedProfile, setMatchedProfile,
        runOCR,
        resetOCR
    } = useOCR(profiles, masterSenders);

    const [pendingDeliveryCount, setPendingDeliveryCount] = useState(0);

    // 우편물 전달 요청 카운트 로드
    const loadPendingDeliveryCount = async () => {
        if (!officeInfo?.id) return;
        try {
            const { count, error } = await supabase
                .from('mail_delivery_requests')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', officeInfo.id)
                .eq('status', 'pending');
            if (!error) setPendingDeliveryCount(count || 0);
        } catch (e) {
            console.error('Failed to load pending delivery count:', e);
        }
    };

    // 실시간 신청 감지용 구독
    useEffect(() => {
        if (!officeInfo?.id) return;

        const subscription = supabase
            .channel('delivery_requests_changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'mail_delivery_requests',
                    filter: `company_id=eq.${officeInfo.id}`
                },
                () => {
                    loadPendingDeliveryCount();
                }
            )
            .subscribe();

        loadPendingDeliveryCount();

        return () => {
            subscription.unsubscribe();
        };
    }, [officeInfo?.id]);

    // 앱 상태(포그라운드) 변경 시 갱신 리스너
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active' && officeInfo?.id) {
                loadPendingDeliveryCount();
            }
        });
        return () => {
            subscription.remove();
        };
    }, [officeInfo?.id]);

    const { handleRegisterMail: registerMailLogic } = useMailRegistration(
        officeInfo,
        null,
        setOcrLoading,
        resetOCR
    );

    // --- UI/Loading States ---

    const handleLoginSuccess = async (profile: any) => {
        if (profile && profile.companies) {
            const myOffice = profile.companies as Company;
            setOfficeInfo(myOffice);

            const [p] = await Promise.all([
                tenantsService.getTenantsByCompany(myOffice.id),
            ]);
            setProfiles(p);

            // 로그인 성공 시 푸시 토큰 저장
            if (expoPushToken) {
                try {
                    await profilesService.updateProfile(profile.id, { push_token: expoPushToken });
                    console.log('[AppContext] Push token saved on login:', expoPushToken);
                } catch (e) {
                    console.error('[AppContext] Failed to save push token on login', e);
                }
            } else if (webPushToken) {
                try {
                    await profilesService.updateProfile(profile.id, { web_push_token: webPushToken });
                    console.log('[AppContext] Web push token saved on login');
                } catch (e) {
                    console.error('[AppContext] Failed to save web push token on login', e);
                }
            }

            setMode('admin_dashboard');
        }
    };

    const loadInitialData = async () => {
        try {
            // 1. 현재 세션 확인
            const { data: { session } } = await supabase.auth.getSession();

            // 2. 공통 데이터(마스터 발신처) 로드
            const senders = await masterSendersService.getAllSenders();
            setMasterSenders(senders.map(s => s.name));

            if (session?.user) {
                // 3. 로그인된 사용자의 프로필 및 오피스 정보 조회
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*, companies(*)')
                    .eq('id', session.user.id)
                    .single();

                if (!profileError && profile && profile.companies) {
                    const myOffice = profile.companies as Company;
                    setOfficeInfo(myOffice);

                    // 4. 해당 오피스의 입주사 로드
                    const p = await tenantsService.getTenantsByCompany(myOffice.id);
                    setProfiles(p);
                }
            }
        } catch (e) {
            console.error("Failed to load initial data", e);
        }
    };

    const setupNotifications = async () => {
        let tokenToSave = '';
        let isWeb = false;

        if (Platform.OS === 'web') {
            if (messaging && typeof Notification !== 'undefined') {
                try {
                    const permission = Notification.permission === 'default'
                        ? await Notification.requestPermission()
                        : Notification.permission;

                    if (permission === 'granted') {
                        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
                        if (token) {
                            setWebPushToken(token);
                            tokenToSave = token;
                            isWeb = true;
                        }
                    }
                } catch (e) {
                    console.error("Web push registration failed", e);
                }
            }
        } else {
            const token = await registerForPushNotificationsAsync();
            if (token) {
                setExpoPushToken(token);
                tokenToSave = token;
            }
        }

        // 세션이 있는 경우 즉시 토큰 저장 시도
        if (tokenToSave) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user?.id) {
                    const profile = await profilesService.updateProfile(session.user.id, {
                        [isWeb ? 'web_push_token' : 'push_token']: tokenToSave
                    });
                    console.log(`[AppContext] ${isWeb ? 'Web ' : ''}Push token auto-saved`);
                } else {
                    // Alert.alert('알림 정보 획득', '로그인 후에 기기가 정식 등록됩니다.');
                }
            } catch (e) {
                console.error('[AppContext] Push token auto-save failed', e);
            }
        } else {
            console.warn('[AppContext] No push token generated');
            // Alert.alert('알림 설정 실패', '기기에서 알림 토큰을 생성할 수 없습니다. 권한 설정을 확인해 주세요.');
        }
    };

    // --- 딥링크 처리 통합 함수 (v24:05 Final) ---
    const handleDeepLink = async (url: string | null) => {
        if (!url) return;
        console.log(`[AppContext] handleDeepLink: ${url}`);

        try {
            const decodedUrl = decodeURIComponent(url);
            
            // 1. MagicId(UUID) 추출 - 어떤 위치에 있든 강제 추출
            const uuidMatch = decodedUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
            const magicId = uuidMatch ? uuidMatch[0] : null;

            // 2. Slug 추출
            const slugMatch = decodedUrl.match(/\/branch\/([^\/?#]+)/);
            const slug = slugMatch ? slugMatch[1] : null;

            if (magicId) {
                console.log(`[AppContext] FAST-TRACK Triggered with MagicId: ${magicId}`);
                
                // [중요] 화면 전환 우선 수행 (UX 속도 개선 핵심)
                setMode('tenant_login');
                // 임시 id를 부여하여 App.tsx의 로딩 체크를 통과하게 함
                setBrandingCompany({ id: magicId, magicId, slug } as any);
                setMagicIdResolved(true); // 화면 열기 허용

                // 백그라운드에서 실제 상세 정보 로드 (비차단)
                const { data, error } = await supabase
                    .from('companies')
                    .select('*')
                    .eq('magic_id', magicId)
                    .single();

                if (data && !error) {
                    console.log(`[AppContext] Detail company loaded: ${data.name}`);
                    setBrandingCompany({ ...data, magicId } as any);
                } else if (error) {
                    // magic_id로 못 찾은 경우 역방향 조회 (최후의 수단)
                    try {
                        const tenant = await tenantsService.getTenantById(magicId);
                        if (tenant?.company_id) {
                            const { data: comp } = await supabase.from('companies').select('*').eq('id', tenant.company_id).single();
                            if (comp) setBrandingCompany({ ...comp, magicId } as any);
                        }
                    } catch (e) { }
                }
            }
        } catch (e) {
            console.error('[AppContext] DeepLink processing failed:', e);
        } finally {
            // 어떤 경우에도 처리가 시도되었음을 표시하여 무한 로딩 방지
            setMagicIdResolved(true);
        }
    };

    const setupDeepLinking = async () => {
        // 타임아웃 적용 (최대 3초만 대기)
        const timeoutPromise = new Promise(resolve => setTimeout(() => {
            console.log('[AppContext] DeepLink Init Timeout');
            setMagicIdResolved(true);
            resolve(null);
        }, 3000));

        try {
            // 1. 초기 URL 획득 (웹 새로고침 상황 고려)
            let initialUrl = await Linking.getInitialURL();
            if (!initialUrl && Platform.OS === 'web' && typeof window !== 'undefined') {
                initialUrl = window.location.href;
            }

            if (initialUrl) {
                await Promise.race([handleDeepLink(initialUrl), timeoutPromise]);
            } else {
                setMagicIdResolved(true);
            }
        } catch (e) {
            console.error('[AppContext] setupDeepLinking failed:', e);
            setMagicIdResolved(true);
        }

        // 2. 앱 실행 중의 딥링크 리스너 등록
        const subscription = Linking.addEventListener('url', (event) => handleDeepLink(event.url));
        return () => subscription.remove();
    };

    useEffect(() => {
        const init = async () => {
            try {
                if (Platform.OS === 'web') {
                    const { redirectToExternalBrowser } = require('../utils/browserDetection');
                    redirectToExternalBrowser();
                }

                // 1. 딥링크 분석 및 화면 전환 설정
                await setupDeepLinking();

                // 2. 비차단 데이터 로드
                loadInitialData();
                setupNotifications();
            } catch (error) {
                console.error('Initialization error:', error);
                setMagicIdResolved(true);
            } finally {
                setIsInitialLoading(false);
            }
        };
        init();
    }, []);

    const handleRegisterMail = async (
        tenant: Tenant | null,
        image: string | null,
        type: MailType,
        sender: string,
        extras: string[],
        customMsg?: string
    ) => {
        const result = await registerMailLogic(
            tenant,
            image,
            type,
            sender,
            extras,
            customMsg
        );
        return result;
    };

    return (
        <AppContext.Provider
            value={{
                mode, setMode,
                isInitializing: isInitialLoading,
                expoPushToken,
                webPushToken,
                brandingCompany, setBrandingCompany,
                tenantProfile, setTenantProfile,
                officeInfo, setOfficeInfo,
                profiles, setProfiles,
                masterSenders, setMasterSenders,
                isAdminMgmtVisible, setIsAdminMgmtVisible,
                isTenantMgmtVisible, setIsTenantMgmtVisible,
                isSenderMgmtVisible, setIsSenderMgmtVisible,
                isHistoryVisible, setIsHistoryVisible,
                isManualSearchVisible, setIsManualSearchVisible,
                selectedProfileForHistory, setSelectedProfileForHistory,
                manualSearchQuery, setManualSearchQuery,
                selectedImage, setSelectedImage,
                ocrLoading,
                recognizedText,
                detectedMailType, setDetectedMailType,
                detectedSender, setDetectedSender,
                matchedProfile, setMatchedProfile,
                extraImages, setExtraImages,
                loadData: loadInitialData,
                runOCR,
                handleRegisterMail,
                optimizeImage: async (uri: string) => {
                    const res = await ocrPreprocess(uri);
                    return res.uri;
                },
                handleLoginSuccess,
                resetOCR,
                magicIdResolved,
                pendingDeliveryCount,
                loadPendingDeliveryCount
            }}
        >
            {children}
        </AppContext.Provider>
    );
};

export const useAppContent = () => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContent must be used within an AppProvider');
    }
    return context;
};
