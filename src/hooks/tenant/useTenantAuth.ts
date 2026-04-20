import { useState, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { profilesService } from '../../services/profilesService';
import { tenantsService, Tenant } from '../../services/tenantsService';

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
    const [name, setName] = useState('');
    const [phoneSuffix, setPhoneSuffix] = useState('');
    const [myProfile, setMyProfile] = useState<any | null>(null);
    const [myTenant, setMyTenant] = useState<Tenant | null>(null);
    const [identifying, setIdentifying] = useState(false);

    // 자동 로그인 및 매직 링크 처리
    useEffect(() => {
        const checkAutoLogin = async () => {
            const targetMagicId = magicTenantId || magicProfileId;
            if (targetMagicId) {
                try {
                    setIdentifying(true);
                    if (magicTenantId) {
                        const tenant = await tenantsService.getTenantById(magicTenantId);
                        if (tenant) {
                            setMyTenant(tenant);
                            setMyProfile(tenant);
                            return;
                        }
                    } else if (magicProfileId) {
                        const profile = await profilesService.getProfileById(magicProfileId);
                        if (profile) {
                            setMyProfile(profile);
                            return;
                        }
                    }
                } catch (e) {
                    console.log('Magic login failed', e);
                } finally {
                    setIdentifying(false);
                }
            }

            // 저장된 자격 증명 확인
            try {
                const storedName = await AsyncStorage.getItem(`tenant_name_${companyId}`);
                const storedPhone = await AsyncStorage.getItem(`tenant_phone_${companyId}`);

                if (storedName && storedPhone) {
                    setName(storedName);
                    setPhoneSuffix(storedPhone);
                    handleIdentify(storedName, storedPhone);
                }
            } catch (e) {
                console.log('Auto login failed', e);
            }
        };
        checkAutoLogin();
    }, [companyId, magicProfileId, magicTenantId]);

    const handleIdentify = async (inputName?: string, inputPhone?: string) => {
        const targetName = inputName || name;
        const targetPhone = inputPhone || phoneSuffix;

        if (!targetName.trim()) {
            showToast({ message: '입주사 명칭을 입력해주세요.', type: 'error' });
            return;
        }
        if (targetPhone.length !== 4) {
            showToast({ message: '전화번호 뒷자리 4자리를 정확히 입력해주세요.', type: 'error' });
            return;
        }

        setIdentifying(true);
        try {
            const profile = await profilesService.getTenantProfile(companyId, targetName.trim(), targetPhone);
            if (!profile) {
                if (!inputName) showToast({ message: '입주사 정보가 일치하지 않습니다.', type: 'error' });
                return;
            }

            // 토큰 업데이트
            if (profile.id) {
                const updates: any = {};
                if (pushToken) updates.push_token = pushToken;
                if (webPushToken) updates.web_push_token = webPushToken;
                if (Object.keys(updates).length > 0) {
                    await profilesService.updateProfile(profile.id, updates);
                }
            }

            await AsyncStorage.setItem(`tenant_name_${companyId}`, targetName.trim());
            await AsyncStorage.setItem(`tenant_phone_${companyId}`, targetPhone);

            setMyProfile(profile);
            setMyTenant(null);
            return profile;
        } catch (err) {
            showToast({ message: '조회 중 문제가 발생했습니다.', type: 'error' });
        } finally {
            setIdentifying(false);
        }
    };

    const handleLogout = async () => {
        const performLogout = async () => {
            try {
                await AsyncStorage.removeItem(`tenant_name_${companyId}`);
                await AsyncStorage.removeItem(`tenant_phone_${companyId}`);
                setMyProfile(null);
                setMyTenant(null);
                setName('');
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
