import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { profilesService } from '../../services/profilesService';

export const usePWAInstall = (profileId?: string) => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallBanner, setShowInstallBanner] = useState(false);
    const [isIOS, setIsIOS] = useState(false);
    const [isStandalone, setIsStandalone] = useState(false);
    const [isInstallComplete, setIsInstallComplete] = useState(false);

    useEffect(() => {
        if (Platform.OS !== 'web') return;

        // 1. 플랫폼 및 모드 확인
        const ua = window.navigator.userAgent.toLowerCase();
        const ios = /iphone|ipad|ipod/.test(ua);
        setIsIOS(ios);

        const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
        setIsStandalone(!!standalone);

        // 2. 안드로이드/크롬 설치 프롬프트 핸들러
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallBanner(true);
        };

        // 3. 설치 안내 노출 결정 (스탠드얼론이 아닐 때 무조건 노출 시도)
        if (!standalone) {
            setShowInstallBanner(true);
        }

        window.addEventListener('beforeinstallprompt', handler);

        const installedHandler = async () => {
            console.log('PWA was installed');
            setShowInstallBanner(false);
            setIsInstallComplete(true);
            if (profileId) {
                await profilesService.updateProfile(profileId, { pwa_installed: true });
            }
        };
        window.addEventListener('appinstalled', installedHandler);

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installedHandler);
        };
    }, [profileId]);

    const handleInstallPrompt = async () => {
        if (isIOS) {
            // iOS는 브라우저 팝업을 띄울 수 없으므로 가이드 모달 등을 표시해야 함
            return 'ios_guide';
        }

        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        setDeferredPrompt(null);
        setShowInstallBanner(false);
        if (outcome === 'accepted') {
            setIsInstallComplete(true);
        }
        return outcome;
    };

    return {
        showInstallBanner,
        setShowInstallBanner,
        handleInstallPrompt,
        isIOS,
        isStandalone,
        isInstallComplete,
        setIsInstallComplete
    };
};
