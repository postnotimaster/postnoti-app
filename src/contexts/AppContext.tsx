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
    profiles: Profile[]; // Tenants inside current office
    setProfiles: (profiles: Profile[]) => void;
    mailLogs: any[];
    setMailLogs: (logs: any[]) => void;
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
    isAdminMenuVisible: boolean;
    setIsAdminMenuVisible: (v: boolean) => void;
    isManualSearchVisible: boolean;
    setIsManualSearchVisible: (v: boolean) => void;

    // Other UI States
    selectedProfileForHistory: Profile | null;
    setSelectedProfileForHistory: (p: Profile | null) => void;
    logSearchQuery: string;
    setLogSearchQuery: (q: string) => void;
    logPageSize: number;
    setLogPageSize: (s: number) => void;
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
    matchedProfile: Profile | null;
    setMatchedProfile: (p: Profile | null) => void;
    extraImages: string[];
    setExtraImages: (imgs: string[]) => void;

    isRefreshing: boolean;

    // Actions
    loadData: () => Promise<void>;
    runOCR: (uri: string) => Promise<void>;
    handleRegisterMail: () => Promise<void>;
    optimizeImage: (uri: string) => Promise<string>;
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
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [masterSenders, setMasterSenders] = useState<string[]>([]);
    const [mailLogs, setMailLogs] = useState<any[]>([]);

    // UI Visibility
    const [isAdminMgmtVisible, setIsAdminMgmtVisible] = useState(false);
    const [isTenantMgmtVisible, setIsTenantMgmtVisible] = useState(false);
    const [isSenderMgmtVisible, setIsSenderMgmtVisible] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [isAdminMenuVisible, setIsAdminMenuVisible] = useState(false);
    const [isManualSearchVisible, setIsManualSearchVisible] = useState(false);

    // Search & Filters
    const [selectedProfileForHistory, setSelectedProfileForHistory] = useState<Profile | null>(null);
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [logPageSize, setLogPageSize] = useState(10);
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
        setMailLogs,
        setOcrLoading,
        resetOCR
    );

    // --- UI/Loading States ---
    const [isRefreshing, setIsRefreshing] = useState(false);

    const loadInitialData = async () => {
        try {
            // [1:1 구조 개편] 첫 번째로 발견되는 회사 정보를 기본 오피스로 로드
            const [compList, senders] = await Promise.all([
                companiesService.getCompanies(),
                masterSendersService.getAllSenders()
            ]);

            if (compList.length > 0) {
                const mainOffice = compList[0];
                setOfficeInfo(mainOffice);

                // 해당 오피스의 입주사 및 우편 로그 자동 로드
                const [p, m] = await Promise.all([
                    profilesService.getProfilesByCompany(mainOffice.id),
                    mailService.getMailsByCompany(mainOffice.id)
                ]);
                setProfiles(p);
                setMailLogs(m);
            }
            setMasterSenders(senders.map(s => s.name));
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
            if (url.includes('postnoti://')) {
                const parts = url.replace('postnoti://', '').split('/');
                if (parts[0] === 'branch') slug = parts[1];
            } else {
                try {
                    const urlObj = new URL(url);
                    const pathParts = urlObj.pathname.split('/').filter(p => p);
                    if (pathParts[0] === 'branch') slug = pathParts[1];
                } catch (e) { }
            }

            if (slug) {
                const { data } = await supabase.from('companies').select('*').eq('slug', slug).single();
                if (data) {
                    setBrandingCompany(data);
                    setMode('tenant_login');
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
                await loadInitialData();
                setupNotifications();
                setupDeepLinking();
            } catch (error) {
                console.error('Initialization error:', error);
            } finally {
                setIsInitialLoading(false);
            }
        };
        init();
    }, []);

    // handleBranchSelect removed in 1:1 refactor

    const handleRegisterMail = async () => {
        const success = await registerMailLogic(
            matchedProfile,
            selectedImage,
            detectedMailType,
            detectedSender,
            extraImages
        );
        if (success) {
            setMode('admin_dashboard');
        }
    };

    return (
        <AppContext.Provider
            value={{
                mode, setMode,
                isInitializing: isInitialLoading,
                isRefreshing,
                expoPushToken,
                webPushToken,
                brandingCompany, setBrandingCompany,
                officeInfo, setOfficeInfo,
                profiles, setProfiles,
                mailLogs, setMailLogs,
                masterSenders, setMasterSenders,
                isAdminMgmtVisible, setIsAdminMgmtVisible,
                isTenantMgmtVisible, setIsTenantMgmtVisible,
                isSenderMgmtVisible, setIsSenderMgmtVisible,
                isHistoryVisible, setIsHistoryVisible,
                isAdminMenuVisible, setIsAdminMenuVisible,
                isManualSearchVisible, setIsManualSearchVisible,
                selectedProfileForHistory, setSelectedProfileForHistory,
                logSearchQuery, setLogSearchQuery,
                logPageSize, setLogPageSize,
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
                }
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
