import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function registerForPushNotificationsAsync() {
    if (!Device.isDevice) return '';

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    if (finalStatus !== 'granted') return '';

    // 안드로이드용 알림 채널 설정 (상단 팝업을 위해 필수)
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    try {
        // Project ID should be loaded from env or constant in real app
        // [수정] app.json의projectId와 일치시켜야 알림이 정상 작동합니다.
        const token = (await Notifications.getExpoPushTokenAsync({
            projectId: 'b970de52-12b9-46d4-b6b6-563385365c00'
        })).data;
        return token;
    } catch (e) {
        return '';
    }
}
