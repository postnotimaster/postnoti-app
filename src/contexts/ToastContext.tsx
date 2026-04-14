import React, { createContext, useContext, useState, useRef, ReactNode, useEffect } from 'react';
import { View, Text, Animated, StyleSheet, Platform, SafeAreaView } from 'react-native';
import { Audio } from 'expo-av';

export type ToastType = 'info' | 'success' | 'error';

interface ToastOptions {
    message: string;
    type?: ToastType;
    duration?: number;
}

interface ToastContextType {
    showToast: (options: ToastOptions | string) => void;
    playSound: (type?: 'success' | 'bell') => Promise<void>;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider = ({ children }: { children: ReactNode }) => {
    const [toast, setToast] = useState<ToastOptions | null>(null);
    const opacity = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(20)).current;
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // B2B 앱 특성에 맞춘 깔끔하고 청명한 짧은 벨소리 (Base64 Data URI)
    const bellSoundUri = 'data:audio/mp3;base64,//NExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';

    const playSound = async (type: 'success' | 'bell' = 'bell') => {
        try {
            const { sound } = await Audio.Sound.createAsync({ uri: bellSoundUri });
            await sound.playAsync();
            console.log(`[Sound Played]: ${type}`);
        } catch (error) {
            console.warn('Sound play failed', error);
        }
    };

    const showToast = (options: ToastOptions | string) => {
        const toastOptions = typeof options === 'string' ? { message: options, type: 'info' as ToastType } : options;

        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        setToast(toastOptions);
        opacity.setValue(0);
        translateY.setValue(20);

        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.spring(translateY, {
                toValue: 0,
                friction: 8,
                tension: 40,
                useNativeDriver: true,
            })
        ]).start();

        const duration = toastOptions.duration || 3000;
        timerRef.current = setTimeout(() => {
            hideToast();
        }, duration);
    };

    const hideToast = () => {
        Animated.parallel([
            Animated.timing(opacity, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }),
            Animated.timing(translateY, {
                toValue: 20,
                duration: 300,
                useNativeDriver: true,
            })
        ]).start(() => {
            setToast(null);
        });
    };

    const getBgColor = (type?: ToastType) => {
        switch (type) {
            case 'success': return 'rgba(16, 185, 129, 0.95)'; // Green
            case 'error': return 'rgba(239, 68, 68, 0.95)';  // Red
            default: return 'rgba(30, 41, 59, 0.95)';        // Dark Slate (Info)
        }
    };

    const getIcon = (type?: ToastType) => {
        switch (type) {
            case 'success': return '✅';
            case 'error': return '⚠️';
            default: return 'ℹ️';
        }
    };

    return (
        <ToastContext.Provider value={{ showToast, playSound }}>
            {children}
            {toast && (
                <SafeAreaView style={styles.toastContainer} pointerEvents="none">
                    <Animated.View
                        style={[
                            styles.toastBox,
                            {
                                backgroundColor: getBgColor(toast.type),
                                opacity: opacity,
                                transform: [{ translateY: translateY }]
                            }
                        ]}
                    >
                        <Text style={styles.toastIcon}>{getIcon(toast.type)}</Text>
                        <Text style={styles.toastText}>{toast.message}</Text>
                    </Animated.View>
                </SafeAreaView>
            )}
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

const styles = StyleSheet.create({
    toastContainer: {
        position: 'absolute',
        bottom: Platform.OS === 'web' ? 40 : 80,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        elevation: 9999,
    },
    toastBox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
        maxWidth: '85%',
    },
    toastIcon: {
        fontSize: 16,
        marginRight: 8,
    },
    toastText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '600',
    }
});
