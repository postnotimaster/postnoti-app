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
    const [permissionStatus, setPermissionStatus] = useState<NotificationPermission | 'default'>(
        typeof Notification !== 'undefined' ? Notification.permission : 'default'
    );

    // 토큰 변경 및 권한 상태 동기화
    useEffect(() => {
        const syncStatus = () => {
            if (typeof Notification !== 'undefined') {
                setPermissionStatus(Notification.permission);
            }
        };
        syncStatus();
        
        const syncToken = async () => {
            if (profileId && webPushToken) {
                console.log(`[NotificationSync] Syncing token for profile: ${profileId}`);
                try {
                    await profilesService.updateProfile(profileId, { 
                        web_push_token: webPushToken,
                        last_accessed_at: new Date().toISOString(),
                        pwa_installed: true // 앱 설치 상태 기록
                    });
                } catch (e) {
                    console.warn('[NotificationSync] Token sync failed:', e);
                }
            }
        };
        syncToken();
    }, [profileId, webPushToken]);

    const requestNotificationPermission = async () => {
        // 웹 환경이 아니면 무시
        if (Platform.OS !== 'web') return;

        // 알림 기능 지원 여부 확인
        if (typeof Notification === 'undefined') {
            return;
        }

        // 이미 권한이 있으면 토큰만 다시 확인하여 갱신
        if (Notification.permission === 'granted') {
            try {
                const token = await getToken(messaging!, { vapidKey: VAPID_KEY });
                if (token && profileId) {
                    await profilesService.updateProfile(profileId, { 
                        web_push_token: token,
                        pwa_installed: true
                    });
                }
            } catch (e) {
                console.warn('[NotificationSync] Silent token refresh failed');
            }
            return;
        }

        // 권한 요청 시작
        setLoading(true);
        try {
            const permission = await Notification.requestPermission();

            if (permission === 'granted') {
                const token = await getToken(messaging!, { vapidKey: VAPID_KEY });
                if (token && profileId) {
                    await profilesService.updateProfile(profileId, { 
                        web_push_token: token,
                        pwa_installed: true
                    });
                    showToast({ message: '알림 설정이 완료되었습니다! 🔔', type: 'success' });
                }
            }
        } catch (error) {
            console.error('Notification Permission Error:', error);
        } finally {
            setLoading(false);
        }
    };

    return {
        requestNotificationPermission,
        permissionStatus
    };
};
