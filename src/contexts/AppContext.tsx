import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Alert, BackHandler } from 'react-native';
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

export type AppMode = 'landing' | 'admin_login' | 'admin_branch_select' | 'admin_dashboard' | 'admin_register_mail' | 'tenant_login' | 'tenant_dashboard';

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
        if (Platform.OS === 'web') {
            if (messaging && typeof Notification !== 'undefined') {
                try {
                    const permission = Notification.permission === 'default'
                        ? await Notification.requestPermission()
                        : Notification.permission;

                    if (permission === 'granted') {
                        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
                        if (token) setWebPushToken(token);
                    }
                } catch (e) {
                    console.error("Web push registration failed", e);
                }
            }
        } else {
            const token = await registerForPushNotificationsAsync();
            if (token) setExpoPushToken(token);
        }
    };

    const setupDeepLinking = async () => {
        const handleDeepLink = async (url: string | null) => {
            console.log(`[AppContext] Handling DeepLink: ${url}`);
            if (!url) return;

            let slug = '';
            let magicId = '';

            // 1. 고도화된 URL 파싱 (UUID 패턴 강제 추출 방식 도입)
            try {
                // A) URL 디코딩 처리
                const decodedUrl = decodeURIComponent(url);

                // B) UUID 패턴 강제 매칭 (가장 강력함 - 어떤 위치에 있든 36자리 UUID만 추출)
                const uuidMatch = decodedUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
                if (uuidMatch) {
                    magicId = uuidMatch[0];
                    console.log('[AppContext] UUID Pattern Match Success:', magicId);
                }

                // C) 기존 방식들 (Fallback)
                if (!magicId) {
                    const pMatch = decodedUrl.match(/(?:\?|&|%3F|%26)p=([^&/?#]+)/i);
                    if (pMatch) magicId = pMatch[1];
                }

                // 슬러그 추출
                const slugMatch = decodedUrl.match(/\/branch\/([^/?#]+)/i);
                if (slugMatch) slug = slugMatch[1];

                // C) Expo Linking API 파서 활용
                const parsed = Linking.parse(url);
                if (!magicId && parsed.queryParams?.p) magicId = parsed.queryParams.p as string;

                // D) Brute-force Split (최후의 수단: 무조건 p= 뒤를 뽑음)
                if (!magicId) {
                    const decoded = decodeURIComponent(url);
                    if (decoded.includes('p=')) {
                        magicId = decoded.split('p=')[1].split('&')[0].split('/')[0];
                    }
                }

                if (!slug) {
                    if (parsed.hostname === 'branch') slug = parsed.path || '';
                    else if (parsed.path?.includes('branch/')) {
                        slug = parsed.path.split('branch/')[1].split('/')[0];
                    }
                }
            } catch (e) {
                console.warn('[AppContext] Parsing error, falling back to manual split:', e);
                const cleanUrl = decodeURIComponent(url);
                if (cleanUrl.includes('p=')) magicId = cleanUrl.split('p=')[1].split('&')[0];
                if (cleanUrl.includes('/branch/')) slug = cleanUrl.split('/branch/')[1].split('/')[0].split('?')[0];
            }

            // --- 후속 처리: ID가 URL 전체인 경우 방지 (Sanitization) ---
            if (magicId && (magicId.includes('://') || magicId.length > 100)) {
                console.log('[AppContext] MagicId looks like a URL, cleaning again...');
                const subMatch = magicId.match(/(?:\?|&|%3F|%26)p=([^&/?#]+)/i);
                if (subMatch) magicId = subMatch[1];
                else magicId = '';
            }

            // Web 전용 패스 추출 보강
            if (!slug && Platform.OS === 'web' && typeof window !== 'undefined') {
                const path = window.location.pathname;
                if (path.includes('/branch/')) slug = path.split('/branch/')[1].split('/')[0];
            }

            // Web 전용 p 추출 보강
            if (!magicId && Platform.OS === 'web' && typeof window !== 'undefined') {
                try {
                    const params = new URLSearchParams(window.location.search);
                    magicId = params.get('p') || '';
                } catch (e) { }
            }

            if (slug || magicId) {
                console.log(`[AppContext] DeepLink Hit - Slug: ${slug || '(없음)'}, MagicId: ${magicId || '(없음)'}`);

                let resolvedCompany: Company | null = null;

                // A) 슬러그가 있는 경우 우선 처리
                if (slug) {
                    try {
                        const { data } = await supabase.from('companies').select('*').ilike('slug', slug.trim()).single();
                        if (data) resolvedCompany = data as Company;
                    } catch (e) { }
                }

                // B) 슬러그가 없거나 못 찾았는데 magicId가 있는 경우 역방향 조회 (Hybrid)
                if (!resolvedCompany && magicId) {
                    console.log(`[AppContext] No slug/company found, attempting reverse lookup for MagicId: ${magicId}`);
                    try {
                        // 1. tenants 테이블 확인
                        const tenantResult = await tenantsService.getTenantById(magicId);
                        let targetCompanyId = tenantResult?.company_id;

                        // 2. profiles 테이블 확인 (legacy)
                        if (!targetCompanyId) {
                            const profileResult = await profilesService.getProfileById(magicId);
                            targetCompanyId = profileResult?.company_id;
                        }

                        if (targetCompanyId) {
                            const { data } = await supabase.from('companies').select('*').eq('id', targetCompanyId).single();
                            if (data) {
                                console.log(`[AppContext] Reverse lookup success! Office: ${data.name}`);
                                resolvedCompany = data as Company;
                            }
                        }
                    } catch (e) {
                        console.error('[AppContext] Reverse lookup error:', e);
                    }
                }

                // C) [FAST-TRACK] 과거 정상 작동 버전의 핵심 로직 복원
                // 매직 ID가 있다면 데이터베이스 조회가 끝나기 전이라도 입주자 모드로 미리 전환하여 Landing 노출 차단
                if (magicId) {
                    console.log(`[AppContext] Fast-tracking to tenant_login with MagicId: ${magicId}`);
                    setMode('tenant_login');
                    // 최소 정보만 담아 우선 세팅 (Wrapper에서 대기 유도)
                    setBrandingCompany({ magicId, slug } as any);
                }

                // D) 최종 결과 조회 및 적용
                if (resolvedCompany) {
                    console.log(`[AppContext] Applying resolved company: ${resolvedCompany.name}`);
                    setBrandingCompany({ ...resolvedCompany, magicId } as any);
                    setMode('tenant_login');
                }
            }
        };

        // 타임아웃 적용 (최대 3초만 대기하고 다음 단계로)
        const timeoutPromise = new Promise(resolve => setTimeout(() => {
            console.log('[AppContext] DeepLink Init Timeout - Proceeding anyway');
            resolve(null);
        }, 3000));

        let initialUrl = await Linking.getInitialURL();
        if (!initialUrl && Platform.OS === 'web' && typeof window !== 'undefined') {
            initialUrl = window.location.href;
        }

        if (initialUrl) {
            await Promise.race([handleDeepLink(initialUrl), timeoutPromise]);
        }

        const subscription = Linking.addEventListener('url', (event) => handleDeepLink(event.url));
        setMagicIdResolved(true);
        return () => subscription.remove();
    };

    useEffect(() => {
        const init = async () => {
            try {
                if (Platform.OS === 'web') {
                    const { redirectToExternalBrowser } = require('../utils/browserDetection');
                    redirectToExternalBrowser();
                }

                // 1. 딥링크 분석 (타임아웃 적용됨)
                await setupDeepLinking();

                // 2. 초기 데이터 로드 (비차단)
                loadInitialData();
                setupNotifications();
            } catch (error) {
                console.error('Initialization error:', error);
            } finally {
                setIsInitialLoading(false);
            }
        };
        init();
    }, []);

    // handleBranchSelect removed in 1:1 refactor

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
