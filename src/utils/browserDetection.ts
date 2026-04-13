import { Platform } from 'react-native';

export const isKakaoTalk = () => {
    if (Platform.OS !== 'web') return false;
    const ua = navigator.userAgent.toLowerCase();
    return ua.includes('kakaotalk');
};

export const redirectToExternalBrowser = () => {
    if (Platform.OS !== 'web') return;

    const url = window.location.href;
    const ua = navigator.userAgent.toLowerCase();

    // 카카오톡 내부 브라우저인지 확인
    if (ua.includes('kakaotalk')) {
        // 안드로이드: Intent 스택을 이용해 크롬 강제 실행 시도
        if (ua.includes('android')) {
            const chromeIntent = `intent://${url.replace(/https?:\/\//i, '')}#Intent;scheme=https;package=com.android.chrome;end`;
            window.location.href = chromeIntent;
        }
        // iOS (아이폰): 카카오톡 전용 커스텀 스킴 이용 시도
        else if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
            // 이 방식은 카카오톡 업데이트 상황에 따라 작동 여부가 달라질 수 있음
            const externalUrl = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
            window.location.href = externalUrl;
        }
    }
};
