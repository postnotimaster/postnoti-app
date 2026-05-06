import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../lib/supabase';
import { Company } from '../services/companiesService';
import { tenantsService, Tenant } from '../services/tenantsService';

export type AppMode = 'landing' | 'admin_login' | 'admin_branch_select' | 'admin_dashboard' | 'admin_register_mail' | 'admin_notification_settings' | 'admin_settings' | 'admin_tenants' | 'admin_delivery' | 'admin_announcements' | 'admin_menu' | 'tenant_login' | 'tenant_dashboard';

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
        try {
            const decodedUrl = decodeURIComponent(url);
            const uuidMatch = decodedUrl.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
            const magicId = uuidMatch ? uuidMatch[0] : null;
            const slugMatch = decodedUrl.match(/\/branch\/([^\/?#]+)/);
            const slug = slugMatch ? slugMatch[1] : null;

            if (magicId) {
                setMode('tenant_login');
                setBrandingCompany({ id: magicId, magicId, slug } as any);
                setMagicIdResolved(true);

                const { data, error } = await supabase.from('companies').select('*').eq('magic_id', magicId).single();
                if (data && !error) {
                    setBrandingCompany({ ...data, magicId } as any);
                }
            }
        } catch (e) {
            console.error('[UIContext] DeepLink failed:', e);
        } finally {
            setMagicIdResolved(true);
        }
    };

    useEffect(() => {
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

            const subscription = Linking.addEventListener('url', (event) => handleDeepLink(event.url));
            return () => subscription.remove();
        };
        init();
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
