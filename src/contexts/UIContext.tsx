import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { Company } from '../services/companiesService';
import { tenantsService, Tenant } from '../services/tenantsService';

export type AppMode = 'landing' | 'admin_login' | 'admin_branch_select' | 'admin_dashboard' | 'admin_register_mail' | 'admin_notification_settings' | 'admin_settings' | 'admin_tenants' | 'admin_delivery' | 'admin_announcements' | 'admin_menu' | 'admin_senders' | 'admin_signup' | 'tenant_login' | 'tenant_dashboard';

interface UIContextType {
    mode: AppMode;
    setMode: (mode: AppMode) => void;
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

export const UIProvider = ({ children, setBrandingCompany }: { children: ReactNode, setBrandingCompany: (c: Company | null) => void }) => {
    const [mode, setMode] = useState<AppMode>('landing');
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
            const paramMMatch = decodedUrl.match(/[?&]m=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
            const paramPMatch = decodedUrl.match(/[?&]p=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
            const msgMagicId = paramMMatch ? paramMMatch[1] : null;
            const tenantId = paramPMatch ? paramPMatch[1] : null;

            console.log('[UIContext] Parsed Params:', { msgMagicId, tenantId });

            // 2. 구형 매직링크 또는 슬러그
            const uuidMatch = (!msgMagicId && !tenantId) ? decodedUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) : null;
            const magicId = msgMagicId || (uuidMatch ? uuidMatch[0] : null);
            const slugMatch = decodedUrl.match(/\/branch\/([^\/?#]+)/);
            const slug = slugMatch ? slugMatch[1] : null;

            if (magicId) {
                // magic_id가 있으면 권한 문제 없이 오피스 정보를 조회할 수 있음
                const { data, error } = await supabase.from('companies').select('*').eq('magic_id', magicId).single();
                if (data && !error) {
                    setMode('tenant_login');
                    setBrandingCompany({ ...data, magicId: data.magic_id, targetTenantId: tenantId } as any);
                } else {
                    // DB 조회 실패해도 일단 화면은 띄워주기 (구형 방식 폴백)
                    setMode('tenant_login');
                    setBrandingCompany({ id: magicId, magicId, slug, targetTenantId: tenantId } as any);
                }
            } else if (tenantId) {
                // 구형 알림 문자 (p=tenant_id 만 있는 경우) - RLS 때문에 실패할 수 있으나 시도는 해봄
                const { data: tenantData } = await supabase.from('tenants').select('company_id').eq('id', tenantId).single();
                if (tenantData?.company_id) {
                    const { data: companyData } = await supabase.from('companies').select('*').eq('id', tenantData.company_id).single();
                    if (companyData) {
                        setMode('tenant_login');
                        setBrandingCompany({ ...companyData, magicId: companyData.magic_id, targetTenantId: tenantId } as any);
                    }
                }
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
            try {
                let initialUrl = await Linking.getInitialURL();
                if (!initialUrl && Platform.OS === 'web') initialUrl = window.location.href;
                if (initialUrl) await handleDeepLink(initialUrl);
                else setMagicIdResolved(true);
            } catch (e) {
                setMagicIdResolved(true);
            } finally {
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
