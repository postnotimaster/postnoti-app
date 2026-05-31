import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { Company } from '../services/companiesService';
import { tenantsService, Tenant } from '../services/tenantsService';
import { base62ToUuid } from '../utils/base62';

export type AppMode = 'landing' | 'admin_login' | 'admin_branch_select' | 'admin_dashboard' | 'admin_register_mail' | 'admin_notification_settings' | 'admin_settings' | 'admin_tenants' | 'admin_delivery' | 'admin_announcements' | 'admin_menu' | 'admin_senders' | 'admin_signup' | 'tenant_login' | 'tenant_dashboard';

interface UIContextType {
    mode: AppMode;
    setMode: (mode: AppMode) => void;
    brandingCompany: Company | null;
    setBrandingCompany: (comp: Company | null) => void;
    isInitializing: boolean;
    magicIdResolved: boolean;
    isAdminMgmtVisible: boolean;
    setIsAdminMgmtVisible: (v: boolean) => void;
    isHistoryVisible: boolean;
    setIsHistoryVisible: (v: boolean) => void;
    isManualSearchVisible: boolean;
    setIsManualSearchVisible: (v: boolean) => void;
    selectedProfileForHistory: Tenant | null;
    setSelectedProfileForHistory: (p: Tenant | null) => void;
    manualSearchQuery: string;
    setManualSearchQuery: (q: string) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export const UIProvider = ({ children }: { children: ReactNode }) => {
    const [mode, setMode] = useState<AppMode>('landing');
    const [brandingCompany, setBrandingCompany] = useState<Company | null>(null);
    const [isInitializing, setIsInitializing] = useState(true);
    const [magicIdResolved, setMagicIdResolved] = useState(false);

    // UI Visibility
    const [isAdminMgmtVisible, setIsAdminMgmtVisible] = useState(false);
    const [isHistoryVisible, setIsHistoryVisible] = useState(false);
    const [isManualSearchVisible, setIsManualSearchVisible] = useState(false);
    const [selectedProfileForHistory, setSelectedProfileForHistory] = useState<Tenant | null>(null);
    const [manualSearchQuery, setManualSearchQuery] = useState('');

    const handleDeepLink = async (url: string | null) => {
        if (!url) return;
        console.log('[UIContext] Handling DeepLink:', url);
        try {
            const decodedUrl = decodeURIComponent(url);
            
            // 1. 신규 우편알림 문자 링크 (m=magic_id & p=tenant_id)
            const paramMMatch = decodedUrl.match(/[?&]m=([^&?#]+)/i);
            const paramPMatch = decodedUrl.match(/[?&]p=([^&?#]+)/i);
            const msgMagicIdRaw = paramMMatch ? paramMMatch[1].trim() : null;
            const tenantIdRaw = paramPMatch ? paramPMatch[1].trim() : null;
            
            const msgMagicId = msgMagicIdRaw === 'undefined' ? null : msgMagicIdRaw;
            let tenantId = tenantIdRaw === 'undefined' ? null : tenantIdRaw;
            if (tenantId) tenantId = base62ToUuid(tenantId);

            console.log('[UIContext] Parsed Params:', { msgMagicId, tenantId });

            // 2. 구형 매직링크 또는 슬러그
            const uuidMatch = (!msgMagicId && !tenantId) ? decodedUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) : null;
            const magicId = msgMagicId || (uuidMatch ? uuidMatch[0] : null);
            const slugMatch = decodedUrl.match(/\/branch\/([^\/?#]+)/);
            const slug = slugMatch ? slugMatch[1] : null;

            /**
             * [절대 수정 금지] 딥링크 파싱 및 인증 역추적 로직
             * 1. p(입주사 ID)가 있으면 지점 정보(m)가 없어도 역추적하여 즉시 인증 진행
             * 2. p가 m보다 우선순위가 높아야 문자 앱 주소 절단 시에도 작동함
             */
            if (tenantId) {
                console.log('[UIContext] P-Parameter detected. Fetching tenant & company info...');
                const tenantData = await tenantsService.getTenantById(tenantId);
                if (tenantData?.company_id) {
                    const { data: companyData } = await supabase.from('companies').select('*').eq('id', tenantData.company_id).single();
                    if (companyData) {
                        setMode('tenant_login');
                        setBrandingCompany({ ...companyData, magicId: companyData.id, targetTenantId: tenantId } as any);
                    }
                }
            } else if (magicId) {
                // p가 없고 m(지점 ID)만 있는 경우 (기본 로그인 화면 노출)
                const { data, error } = await supabase.from('companies').select('*').eq('id', magicId).single();
                if (data && !error) {
                    setMode('tenant_login');
                    setBrandingCompany({ ...data, magicId: data.id, targetTenantId: null } as any);
                }
            }
            
            // [핵심] PWA를 위해 성공적으로 파싱된 주소 영구 저장
            if (magicId || tenantId || slug) {
                await AsyncStorage.setItem('last_tenant_url', url);
            }

        } catch (e) {
            console.error('[UIContext] DeepLink failed:', e);
        } finally {
            setMagicIdResolved(true);
        }
    };

    useEffect(() => {
        let subscription: any;
        const init = async () => {
            // 3초 후에는 무조건 로딩 완료 처리 (백지 화면 방지 세이프가드)
            const timeout = setTimeout(() => {
                setMagicIdResolved(true);
                setIsInitializing(false);
            }, 3000);

            try {
                let initialUrl: string | null = null;
                
                if (Platform.OS === 'web') {
                    initialUrl = window.location.href;
                } else {
                    initialUrl = await Linking.getInitialURL();
                }

                console.log('[UIContext] Detected Initial URL:', initialUrl);

                if (initialUrl && (initialUrl.includes('?') || initialUrl.includes('branch') || initialUrl.includes('postnoti://'))) {
                    await handleDeepLink(initialUrl);
                } else {
                    // [핵심] 파라미터가 없는 깡통 주소(/)로 접속 시 과거 저장된 우편함 주소로 자동 리다이렉트
                    const savedUrl = await AsyncStorage.getItem('last_tenant_url');
                    if (savedUrl) {
                        console.log('[UIContext] PWA Auto-Redirect to saved URL:', savedUrl);
                        await handleDeepLink(savedUrl);
                    } else {
                        setMagicIdResolved(true);
                    }
                }
            } catch (e) {
                console.error('[UIContext] Init failed:', e);
                setMagicIdResolved(true);
            } finally {
                clearTimeout(timeout);
                setIsInitializing(false);
            }
        };
        init();
        subscription = Linking.addEventListener('url', (event) => handleDeepLink(event.url));
        return () => subscription?.remove();
    }, []);

    return (
        <UIContext.Provider value={{
            mode, setMode,
            brandingCompany, setBrandingCompany,
            isInitializing,
            magicIdResolved,
            isAdminMgmtVisible, setIsAdminMgmtVisible,
            isHistoryVisible, setIsHistoryVisible,
            isManualSearchVisible, setIsManualSearchVisible,
            selectedProfileForHistory, setSelectedProfileForHistory,
            manualSearchQuery, setManualSearchQuery
        }}>
            {children}
        </UIContext.Provider>
    );
};

export const useUI = () => {
    const context = useContext(UIContext);
    if (!context) throw new Error('useUI must be used within a UIProvider');
    return context;
};
