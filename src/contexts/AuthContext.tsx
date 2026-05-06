import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { Company } from '../services/companiesService';
import { Tenant } from '../services/tenantsService';
import { profilesService } from '../services/profilesService';
import { tenantsService } from '../services/tenantsService';

interface AuthContextType {
    officeInfo: Company | null;
    setOfficeInfo: (comp: Company | null) => void;
    tenantProfile: any | null;
    setTenantProfile: (p: any | null) => void;
    brandingCompany: Company | null;
    setBrandingCompany: (comp: Company | null) => void;
    profiles: Tenant[];
    setProfiles: (tenants: Tenant[]) => void;
    handleLoginSuccess: (profile: any, expoPushToken?: string, webPushToken?: string) => Promise<void>;
    loadInitialData: () => Promise<void>;
    isInitializing: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [officeInfo, setOfficeInfo] = useState<Company | null>(null);
    const [tenantProfile, setTenantProfile] = useState<any | null>(null);
    const [brandingCompany, setBrandingCompany] = useState<Company | null>(null);
    const [profiles, setProfiles] = useState<Tenant[]>([]);
    const [isInitializing, setIsInitializing] = useState(true);

    const loadInitialData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*, companies(*)')
                    .eq('id', session.user.id)
                    .single();

                if (!profileError && profile && profile.companies) {
                    const myOffice = profile.companies as Company;
                    setOfficeInfo(myOffice);
                    const p = await tenantsService.getTenantsByCompany(myOffice.id);
                    setProfiles(p);
                }
            }
        } catch (e) {
            console.error("[AuthContext] Failed to load initial data", e);
        } finally {
            setIsInitializing(false);
        }
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    const handleLoginSuccess = async (profile: any, expoPushToken?: string, webPushToken?: string) => {
        if (profile && profile.companies) {
            const myOffice = profile.companies as Company;
            setOfficeInfo(myOffice);

            const p = await tenantsService.getTenantsByCompany(myOffice.id);
            setProfiles(p);

            // 로그인 성공 시 푸시 토큰 저장
            if (expoPushToken) {
                try {
                    await profilesService.updateProfile(profile.id, { push_token: expoPushToken });
                } catch (e) {
                    console.error('[AuthContext] Failed to save push token on login', e);
                }
            } else if (webPushToken) {
                try {
                    await profilesService.updateProfile(profile.id, { web_push_token: webPushToken });
                } catch (e) {
                    console.error('[AuthContext] Failed to save web push token on login', e);
                }
            }
        }
    };

    return (
        <AuthContext.Provider value={{
            officeInfo, setOfficeInfo,
            tenantProfile, setTenantProfile,
            brandingCompany, setBrandingCompany,
            profiles, setProfiles,
            handleLoginSuccess
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
