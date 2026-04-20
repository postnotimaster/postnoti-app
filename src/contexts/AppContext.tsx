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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    // --- States ---
    const [mode, setMode] = useState<AppMode>('landing');
    const [brandingCompany, setBrandingCompany] = useState<Company | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [expoPushToken, setExpoPushToken] = useState('');
    const [webPushToken, setWebPushToken] = useState('');

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
            if (!url) return;

            let slug = '';
            // 1. 웹 브라우저 직접 접속인 경우 (Landing bypass를 위해 window.location 우선 확인)
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                const path = window.location.pathname;
                if (path.includes('/branch/')) {
                    slug = path.split('/branch/')[1].split('/')[0];
                }
            }

            // 2. Linking API를 통한 유입 (기존 및 보강 로직)
            if (!slug) {
                if (url.includes('postnoti://')) {
                    const parts = url.replace('postnoti://', '').split('/');
                    if (parts[0] === 'branch') slug = parts[1];
                } else {
                    try {
                        const urlObj = new URL(url);
                        const pathParts = urlObj.pathname.split('/').filter(p => p);
                        if (pathParts[0] === 'branch') slug = pathParts[1];
                    } catch (e) {
                        if (url.includes('/branch/')) {
                            slug = url.split('/branch/')[1].split('/')[0].split('?')[0];
                        }
                    }
                }
            }

            if (slug) {
                // 3. magicId 추출 보강
                let magicId = '';
                try {
                    const urlObj = new URL(url);
                    magicId = urlObj.searchParams.get('p') || '';
                } catch (e) {
                    if (url.includes('p=')) {
                        magicId = url.split('p=')[1].split('&')[0];
                    }
                }

                if (!magicId && Platform.OS === 'web' && typeof window !== 'undefined') {
                    try {
                        const params = new URLSearchParams(window.location.search);
                        magicId = params.get('p') || '';
                    } catch (e) { }
                }

                // [DEBUG] 추출된 정보 확인
                console.log(`[AppContext] DeepLink Hit - Slug: ${slug}, MagicId: ${magicId}`);

                // 즉시 모드 전환 (화면 깜빡임 방지 및 내비게이션 동기화)
                setMode('tenant_login');

                // 비동기로 상세 정보 로드
                try {
                    console.log(`[AppContext] Fetching company data for slug: ${slug}`);
                    const { data, error: companyError } = await supabase
                        .from('companies')
                        .select('*')
                        .ilike('slug', slug.trim())
                        .single();

                    if (companyError) {
                        console.error('[AppContext] Company Query Error:', companyError);
                        // 에러가 나면 랜딩으로 복귀
                        setMode('landing');
                        setBrandingCompany(null);
                        return;
                    }

                    if (data) {
                        console.log(`[AppContext] Company loaded: ${data.name} (${data.id})`);
                        setBrandingCompany({ ...data, magicId } as any);
                    } else {
                        console.warn('[AppContext] Company not found for slug:', slug);
                        setMode('landing');
                        setBrandingCompany(null);
                    }
                } catch (e) {
                    console.error('[AppContext] Unexpected deep link error:', e);
                    setMode('landing');
                }
            }
        };

        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) await handleDeepLink(initialUrl);

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

                // 1. 딥링크 분석 (가장 먼저 수행, 비로그인 입주사 대응)
                await setupDeepLinking();

                // 2. 초기 데이터 및 알림 설정 (백그라운드 병행)
                loadInitialData();
                setupNotifications(); // await 제거 (블로킹 방지)
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
                resetOCR
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
