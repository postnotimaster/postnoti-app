import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Platform, AppState } from 'react-native';
import { supabase } from '../lib/supabase';
import { registerForPushNotificationsAsync } from '../utils/notificationHelper';
import * as Notifications from 'expo-notifications';
import { messaging, getToken, VAPID_KEY } from '../lib/firebase';
import { profilesService } from '../services/profilesService';
import { masterSendersService } from '../services/masterSendersService';
import { useAuth } from './AuthContext';

interface NotificationContextType {
    expoPushToken: string;
    webPushToken: string;
    pendingDeliveryCount: number;
    loadPendingDeliveryCount: () => Promise<void>;
    refreshMasterSenders: () => Promise<void>;
    masterSenders: string[];
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider = ({ children }: { children: ReactNode }) => {
    const { officeInfo } = useAuth();
    const [expoPushToken, setExpoPushToken] = useState('');
    const [webPushToken, setWebPushToken] = useState('');
    const [pendingDeliveryCount, setPendingDeliveryCount] = useState(0);
    const [masterSenders, setMasterSenders] = useState<string[]>([]);

    const loadMasterSenders = async () => {
        const senders = await masterSendersService.getAllSenders();
        setMasterSenders(senders.map(s => s.name));
    };

    const loadPendingDeliveryCount = async () => {
        if (!officeInfo?.id) return;
        try {
            const { count, error } = await supabase
                .from('mail_delivery_requests')
                .select('*', { count: 'exact', head: true })
                .eq('company_id', officeInfo.id)
                .eq('status', 'pending');
            if (!error) setPendingDeliveryCount(count || 0);
        } catch (e) {
            console.error('[NotificationContext] Failed to load count:', e);
        }
    };

    const setupNotifications = async () => {
        let tokenToSave = '';
        let isWeb = false;

        if (Platform.OS === 'web') {
            if (messaging && typeof Notification !== 'undefined') {
                try {
                    const permission = Notification.permission === 'default'
                        ? await Notification.requestPermission()
                        : Notification.permission;
                    if (permission === 'granted') {
                        const token = await getToken(messaging, { vapidKey: VAPID_KEY });
                        if (token) {
                            setWebPushToken(token);
                            tokenToSave = token;
                            isWeb = true;
                        }
                    }
                } catch (e) {}
            }
        } else {
            const token = await registerForPushNotificationsAsync();
            if (token) {
                setExpoPushToken(token);
                tokenToSave = token;
            }
        }

        if (tokenToSave) {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user?.id) {
                    console.log(`[NotificationContext] Saving admin token: ${tokenToSave} for user: ${session.user.id}`);
                    await profilesService.updateProfile(session.user.id, {
                        [isWeb ? 'web_push_token' : 'push_token']: tokenToSave
                    });
                }
            } catch (e) {
                console.error('[NotificationContext] Failed to save admin token:', e);
            }
        }
    };

    useEffect(() => {
        loadMasterSenders();
        setupNotifications();

        if (Platform.OS !== 'web') {
            const subscription = Notifications.addNotificationReceivedListener(notification => {
                console.log('[NotificationContext] Native notification received in foreground:', notification);
            });

            const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
                console.log('[NotificationContext] Native notification clicked:', response);
            });

            return () => {
                subscription.remove();
                responseSubscription.remove();
            };
        }
    }, []);

    useEffect(() => {
        if (!officeInfo?.id) return;

        const subscription = supabase
            .channel('delivery_requests_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'mail_delivery_requests', filter: `company_id=eq.${officeInfo.id}` }, 
            () => loadPendingDeliveryCount())
            .subscribe();

        loadPendingDeliveryCount();

        const appStateSub = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') loadPendingDeliveryCount();
        });

        return () => {
            subscription.unsubscribe();
            appStateSub.remove();
        };
    }, [officeInfo?.id]);

    return (
        <NotificationContext.Provider value={{
            expoPushToken,
            webPushToken,
            pendingDeliveryCount,
            loadPendingDeliveryCount,
            refreshMasterSenders: loadMasterSenders,
            masterSenders
        }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) throw new Error('useNotifications must be used within a NotificationProvider');
    return context;
};
