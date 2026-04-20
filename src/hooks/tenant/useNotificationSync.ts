import { useEffect } from 'react';
import { Platform } from 'react-native';
import { profilesService } from '../../services/profilesService';
import { messaging, getToken, VAPID_KEY } from '../../lib/firebase';

interface UseNotificationSyncProps {
    profileId?: string;
    webPushToken?: string;
    showToast: (params: { message: string; type: 'success' | 'error' | 'info' }) => void;
    setLoading: (loading: boolean) => void;
}

export const useNotificationSync = ({
    profileId,
    webPushToken,
    showToast,
    setLoading
}: UseNotificationSyncProps) => {
    // 토큰 변경 시 동기화
    useEffect(() => {
        if (profileId && webPushToken) {
            profilesService.updateProfile(profileId, { web_push_token: webPushToken });
        }
    }, [profileId, webPushToken]);

    const requestNotificationPermission = async () => {
        if (Platform.OS !== 'web') return;

        if (typeof Notification === 'undefined') {
            showToast({ message: '사파리 앱에서 "홈 화면에 추가"를 먼저 해주세요!', type: 'error' });
            return;
        }

        if (!messaging) {
            showToast({ message: '알림 엔진 준비 중... 인터넷 연결을 확인해주세요.', type: 'error' });
            return;
        }

        setLoading(true);
        try {
            const permission = await Notification.requestPermission();

            if (permission === 'granted') {
                const token = await getToken(messaging, { vapidKey: VAPID_KEY });
                if (token && profileId) {
                    await profilesService.updateProfile(profileId, { web_push_token: token });
                    showToast({ message: '알림 설정 완료! 새 우편물이 도착하면 알려드립니다.', type: 'success' });
                } else {
                    showToast({ message: '알림 정보를 가져오지 못했습니다. 다시 시도해주세요.', type: 'error' });
                }
            } else if (permission === 'denied') {
                showToast({ message: '알림 권한이 차단되어 있습니다. 설정에서 알림을 켜주세요.', type: 'error' });
            }
        } catch (error) {
            console.error('Notification Error:', error);
            showToast({ message: '설정 중 오류가 발생했습니다.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return {
        requestNotificationPermission
    };
};
