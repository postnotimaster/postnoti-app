import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { profilesService } from '../../services/profilesService';

export const usePWAInstall = (profileId?: string) => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstallBanner, setShowInstallBanner] = useState(false);

    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            setShowInstallBanner(true);
        };

        window.addEventListener('beforeinstallprompt', handler);

        const installedHandler = async () => {
            console.log('PWA was installed');
            setShowInstallBanner(false);
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
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        setDeferredPrompt(null);
        setShowInstallBanner(false);
    };

    return {
        showInstallBanner,
        setShowInstallBanner,
        handleInstallPrompt
    };
};
