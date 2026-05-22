import { useState, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import { profilesService } from '../../services/profilesService';
import { tenantsService, Tenant } from '../../services/tenantsService';
import { useAuth } from '../../contexts/AuthContext';

interface UseTenantAuthProps {
    companyId: string;
    magicProfileId?: string;
    magicTenantId?: string;
    pushToken?: string;
    webPushToken?: string;
    showToast: (params: { message: string; type: 'success' | 'error' | 'info' }) => void;
}

export const useTenantAuth = ({
    companyId,
    magicProfileId,
    magicTenantId,
    pushToken,
    webPushToken,
    showToast
}: UseTenantAuthProps) => {
    const { tenantProfile, setTenantProfile } = useAuth();
    const [name, setName] = useState('');
    const [phoneSuffix, setPhoneSuffix] = useState('');
    const [myProfile, setMyProfile] = useState<any | null>(tenantProfile);
    const [myTenant, setMyTenant] = useState<Tenant | null>(null);
    const [identifying, setIdentifying] = useState(false);

    // Sync local state when global state changes
    useEffect(() => {
        setMyProfile(tenantProfile);
    }, [tenantProfile]);

    // 자동 로그인 및 매직 링크 처리
    useEffect(() => {
        const checkAutoLogin = async () => {
            if (tenantProfile) {
                console.log('[useTenantAuth] Already logged in via context');
                return;
            }

            const targetMagicId = magicTenantId || magicProfileId;
            console.log(`[useTenantAuth] Starting AutoLogin Check. MagicId: ${targetMagicId}`);

            if (targetMagicId) {
                try {
                    setIdentifying(true);
                    
                    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(targetMagicId);

                    // [최우선] 입주사 ID(magicTenantId)로 인증 시도 (즉시 로그인)
                    if (isUUID) {
                        try {
                            console.log(`[useTenantAuth] Attempting Instant Magic Login (ID: ${targetMagicId})`);
                            const tenantResult = await tenantsService.getTenantById(targetMagicId);

                            if (tenantResult) {
                                console.log(`[useTenantAuth] SUCCESS: Instant Login for ${tenantResult.name}`);
                                
                                // [중요] 배경에서 조용히 프로필 생성/연결 및 토큰 동기화
                                if (tenantResult.id) {
                                    try {
                                        console.log('[useTenantAuth] Syncing profile and tokens via secure RPC (Auto)...');
                                        const { data: upsertData, error: upsertErr } = await supabase.rpc('upsert_tenant_profile_secure', {
                                            p_id: tenantResult.profile_id || tenantResult.id,
                                            p_company_id: companyId,
                                            p_name: tenantResult.name,
                                            p_phone: tenantResult.phone,
                                            p_push_token: pushToken || null,
                                            p_web_push_token: webPushToken || null
                                        });

                                        if (upsertErr) throw upsertErr;
                                        const profileData = (Array.isArray(upsertData) ? upsertData[0] : upsertData) || tenantResult;

                                        // 4. 테넌트 레코드에 프로필 ID 연결 (관리자 앱 인식용)
                                        if (!tenantResult.profile_id && profileData?.id) {
                                            await tenantsService.updateTenant(tenantResult.id, { profile_id: profileData.id });
                                        }
                                    } catch (e) {
                                        console.warn('[useTenantAuth] Background linking failed:', e);
                                    }
                                }

                                setMyTenant(tenantResult);
                                setMyProfile(tenantResult);
                                setTenantProfile(tenantResult); // [즉시 로그인 실행]
                                return;
                            }
                        } catch (err) {
                            console.warn(`[useTenantAuth] Magic login failed:`, err);
                        }
                    }

                    // 2. Second attempt: search in profiles table (Legacy/Alternative magic link)
                    try {
                        console.log(`[useTenantAuth] Attempt 2: Fetching from profiles table (ID: ${targetMagicId})`);
                        // Use a fallback RPC or direct query. Note: direct query might fail due to RLS if anon user.
                        let profileResult = await profilesService.getProfileById(targetMagicId);

                        if (profileResult) {
                            console.log(`[useTenantAuth] SUCCESS: Found in profiles table: ${profileResult.name}`);
                            setMyProfile(profileResult);
                            setTenantProfile(profileResult);
                            return;
                        }
                    } catch (err) {
                        console.warn(`[useTenantAuth] Attempt 2 failed for ${targetMagicId} (possibly RLS):`, err);
                    }

                    console.warn(`[useTenantAuth] FAILED: ID ${targetMagicId} not found in neither tenants nor profiles`);
                } catch (e) {
                    console.error('[useTenantAuth] Magic login exception:', e);
                } finally {
                    setIdentifying(false);
                }
            }

            // 저장된 자격 증명 확인
            try {
                const storedPhone = await AsyncStorage.getItem(`tenant_phone_${companyId}`);

                if (storedPhone) {
                    setPhoneSuffix(storedPhone);
                    handleIdentify(storedPhone);
                }
            } catch (e) {
                console.log('Auto login failed', e);
            }
        };
        checkAutoLogin();
    }, [companyId, magicProfileId, magicTenantId]);

    const handleIdentify = async (inputPhone?: string) => {
        const targetPhone = inputPhone || phoneSuffix;

        let fullPhone = targetPhone.replace(/[^0-9]/g, '');
        if (fullPhone.length > 0 && !fullPhone.startsWith('010')) {
            fullPhone = '010' + fullPhone;
        }

        if (fullPhone.length < 10 || fullPhone.length > 11) {
            showToast({ message: '올바른 휴대전화 번호를 입력해주세요.', type: 'error' });
            return;
        }

        setIdentifying(true);
        try {
            let profile = await profilesService.getTenantProfileByPhone(companyId, fullPhone);
            let resolvedTenant = await tenantsService.findTenantByPhone(companyId, fullPhone);
            
            if (resolvedTenant) {
                try {
                    console.log('[useTenantAuth] Syncing profile and tokens via secure RPC (Manual)...');
                    const { data: upsertData, error: upsertErr } = await supabase.rpc('upsert_tenant_profile_secure', {
                        p_id: resolvedTenant.profile_id || resolvedTenant.id,
                        p_company_id: companyId,
                        p_name: resolvedTenant.name,
                        p_phone: resolvedTenant.phone,
                        p_push_token: pushToken || null,
                        p_web_push_token: webPushToken || null
                    });
                    if (upsertErr) throw upsertErr;
                    profile = (Array.isArray(upsertData) ? upsertData[0] : upsertData) || resolvedTenant;

                    // 테넌트 레코드에 프로필 ID 연결
                    if (!resolvedTenant.profile_id && profile?.id) {
                        await tenantsService.updateTenant(resolvedTenant.id, { profile_id: profile.id });
                    }
                } catch (e) {
                    console.warn('[useTenantAuth] Upserting profile failed, falling back:', e);
                    profile = profile || resolvedTenant as any;
                }
            }

            if (!profile && !resolvedTenant) {
                if (!inputPhone) showToast({ message: '등록되지 않은 전화번호이거나 지점 정보가 일치하지 않습니다.', type: 'error' });
                return;
            }

            await AsyncStorage.setItem(`tenant_phone_${companyId}`, targetPhone);

            const finalProfile = profile || resolvedTenant;
            console.log(`[useTenantAuth] Identification success for phone: ${fullPhone}`);
            setMyProfile(finalProfile as any);
            setTenantProfile(finalProfile as any); // [중요] 전역 상태 업데이트
            setMyTenant(resolvedTenant); // [중요] myTenant를 반드시 설정하여 메일 조회 시 tenant_id가 쓰이게 함!
            return finalProfile;
        } catch (err) {
            console.error('[useTenantAuth] Identification error:', err);
            showToast({ message: '조회 중 문제가 발생했습니다.', type: 'error' });
        } finally {
            setIdentifying(false);
        }
    };

    const handleLogout = async () => {
        const performLogout = async () => {
            try {
                // await AsyncStorage.removeItem(`tenant_name_${companyId}`); // 입주사명은 영구 기억
                await AsyncStorage.removeItem(`tenant_phone_${companyId}`);
                setMyProfile(null);
                setMyTenant(null);
                // setName(''); // 입주사명은 로그아웃해도 그대로 유지되도록 주석 처리
                setPhoneSuffix('');
            } catch (e) {
                console.error('Logout failed', e);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('로그아웃 하시겠습니까?')) performLogout();
        } else {
            Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
                { text: '취소', style: 'cancel' },
                { text: '로그아웃', style: 'destructive', onPress: performLogout }
            ]);
        }
    };

    return {
        name, setName,
        phoneSuffix, setPhoneSuffix,
        myProfile, setMyProfile,
        myTenant, setMyTenant,
        identifying,
        handleIdentify,
        handleLogout
    };
};
