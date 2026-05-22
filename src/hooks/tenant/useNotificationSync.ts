import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { profilesService } from '../../services/profilesService';
import { supabase } from '../../lib/supabase';
import { messaging, getToken, VAPID_KEY, onMessage } from '../../lib/firebase';

interface UseNotificationSyncProps {
    profileId?: string;
    pushToken?: string;
    webPushToken?: string;
    showToast: (params: { message: string; type: 'success' | 'error' | 'info' }) => void;
    setLoading: (loading: boolean) => void;
}

export const useNotificationSync = ({
    profileId,
    pushToken,
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
            if (profileId && (pushToken || webPushToken)) {
                console.log(`[NotificationSync] Syncing tokens for profile: ${profileId}`);
                try {
                    const { error } = await supabase.rpc('update_tenant_push_token_secure', {
                        p_profile_id: profileId,
                        p_push_token: pushToken || null,
                        p_web_push_token: webPushToken || null
                    });
                    if (error) throw error;
                } catch (e) {
                    console.warn('[NotificationSync] Token sync failed:', e);
                }
            }
        };
        syncToken();
    }, [profileId, pushToken, webPushToken]);

    // Foreground Firebase messaging handler for Web
    useEffect(() => {
        if (Platform.OS === 'web' && messaging) {
            const unsubscribe = onMessage(messaging, (payload) => {
                console.log('[NotificationSync] Foreground message received:', payload);
                const title = payload.data?.title || payload.notification?.title || '알림';
                const body = payload.data?.body || payload.notification?.body || '새 알림이 있습니다.';
                showToast({
                    message: `${title}: ${body}`,
                    type: 'info'
                });
            });
            return () => unsubscribe();
        }
    }, [showToast]);

    const requestNotificationPermission = async () => {
        // 웹 환경이 아니면 무시
        if (Platform.OS !== 'web') return;

        // 알림 기능 지원 여부 확인
        if (typeof Notification === 'undefined') {
            return;
        }

        const getWebPushToken = async () => {
            let registration: ServiceWorkerRegistration | undefined;
            if ('serviceWorker' in navigator) {
                try {
                    registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                } catch (swErr) {
                    console.warn('[NotificationSync] SW registration failed:', swErr);
                }
            }
            return await getToken(messaging!, { 
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });
        };

        // 이미 권한이 있으면 토큰만 다시 확인하여 갱신
        if (Notification.permission === 'granted') {
            try {
                const token = await getWebPushToken();
                if (token && profileId) {
                    const { error } = await supabase.rpc('update_tenant_push_token_secure', {
                        p_profile_id: profileId,
                        p_push_token: null,
                        p_web_push_token: token
                    });
                    if (error) throw error;
                }
            } catch (e) {
                console.warn('[NotificationSync] Silent token refresh failed:', e);
            }
            return;
        }

        // 권한 요청 시작
        setLoading(true);
        try {
            const permission = await Notification.requestPermission();
            setPermissionStatus(permission);

            if (permission === 'granted') {
                const token = await getWebPushToken();
                if (token && profileId) {
                    const { error } = await supabase.rpc('update_tenant_push_token_secure', {
                        p_profile_id: profileId,
                        p_push_token: null,
                        p_web_push_token: token
                    });
                    if (error) throw error;
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
