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
            // ... (existing handleDeepLink logic - I will replace the whole function for clarity)
            if (!url) return;

            let slug = '';
            // 1. 웹 브라우저 직접 접속인 경우
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                const path = window.location.pathname;
                if (path.includes('/branch/')) {
                    slug = path.split('/branch/')[1].split('/')[0];
                }
            }

            // 2. Linking API를 통한 유입
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

            // 3. 매직 ID 파싱 (p 파라미터)
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

            // [핵심] 지점 개념 제거 대응: 슬러그가 없더라도 매직ID가 있다면 입주자 모드로 진입
            if (slug || magicId) {
                console.log(`[AppContext] DeepLink Hit - Slug: ${slug || '(없음)'}, MagicId: ${magicId || '(없음)'}`);
                setMode('tenant_login');

                if (slug) {
                    try {
                        const { data, error: companyError } = await supabase
                            .from('companies')
                            .select('*')
                            .ilike('slug', slug.trim())
                            .single();

                        if (!companyError && data) {
                            console.log(`[AppContext] Company loaded via slug: ${data.name}`);
                            setBrandingCompany({ ...data, magicId } as any);
                        } else {
                            // 슬러그가 틀렸어도 매직ID가 있으면 진행하도록 허용 (Wrapper에서 해결)
                            if (magicId) setBrandingCompany({ magicId } as any);
                        }
                    } catch (e) {
                        if (magicId) setBrandingCompany({ magicId } as any);
                    }
                } else if (magicId) {
                    // 슬러그가 아예 없는 경우 매직ID로만 구성
                    setBrandingCompany({ magicId } as any);
                }
            }
        };

        // 타임아웃 적용 (최대 3초만 대기하고 다음 단계로)
        const timeoutPromise = new Promise(resolve => setTimeout(() => {
            console.log('[AppContext] DeepLink Init Timeout - Proceeding anyway');
            resolve(null);
        }, 3000));

        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
            await Promise.race([handleDeepLink(initialUrl), timeoutPromise]);
        }

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
