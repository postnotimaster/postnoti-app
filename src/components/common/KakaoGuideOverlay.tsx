import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, Dimensions, Image } from 'react-native';
import { isKakaoTalk } from '../../utils/browserDetection';

const { width, height } = Dimensions.get('window');

export const KakaoGuideOverlay = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // 웹환경에서만 작동
        if (Platform.OS === 'web' && isKakaoTalk()) {
            setVisible(true);
        }
    }, []);

    if (!visible || Platform.OS !== 'web') return null;

    // navigator는 웹환경에서만 존재함
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : '';
    const isIOS = /iphone|ipad|ipod/i.test(ua);

    return (
        <View style={styles.fullscreenOverlay}>
            <View style={styles.guideBox}>
                <View style={styles.iconCircle}>
                    <Text style={styles.mainIcon}>⚠️</Text>
                </View>

                <Text style={styles.title}>외부 브라우저 권장</Text>
                <Text style={styles.description}>
                    카카오톡 브라우저에서는 {"\n"}
                    <Text style={styles.highlight}>알림(Push) 기능이 작동하지 않습니다.</Text>
                </Text>

                <View style={styles.stepContainer}>
                    <Text style={styles.stepTitle}>우편물 알림을 받으려면?</Text>

                    {isIOS ? (
                        /* iPhone Guide */
                        <View style={styles.stepItem}>
                            <View style={styles.badge}><Text style={styles.badgeText}>1</Text></View>
                            <Text style={styles.stepText}>하단 <Text style={styles.bold}>[ 공유 아이콘 ]</Text> 클릭</Text>
                            <View style={styles.badge}><Text style={styles.badgeText}>2</Text></View>
                            <Text style={styles.stepText}><Text style={styles.bold}>[ Safari로 열기 ]</Text> 선택</Text>
                        </View>
                    ) : (
                        /* Android Guide */
                        <View style={styles.stepItem}>
                            <View style={styles.badge}><Text style={styles.badgeText}>1</Text></View>
                            <Text style={styles.stepText}>우측 상단 <Text style={styles.bold}>[ ⋮ ]</Text> 버튼 클릭</Text>
                            <View style={styles.badge}><Text style={styles.badgeText}>2</Text></View>
                            <Text style={styles.stepText}><Text style={styles.bold}>[ 다른 브라우저로 열기 ]</Text> 선택</Text>
                        </View>
                    )}
                </View>

                <Pressable
                    onPress={() => setVisible(false)}
                    style={styles.closeBtn}
                >
                    <Text style={styles.closeBtnText}>무시하고 계속하기 (알림 기능 제한됨)</Text>
                </Pressable>
            </View>

            <View style={[
                styles.arrowPointer,
                isIOS ? { bottom: 60 } : { top: 20 }
            ]}>
                <Text style={styles.arrowEmoji}>{isIOS ? '↓' : '↑'}</Text>
                <Text style={styles.arrowText}>여기 버튼 클릭!</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    fullscreenOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(30, 41, 59, 0.95)', // Slate-900 with opacity
        zIndex: 99999,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    guideBox: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 32,
        width: '100%',
        maxWidth: 400,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    iconCircle: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#FEF3C7',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    mainIcon: {
        fontSize: 32,
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: '#1E293B',
        marginBottom: 12,
    },
    description: {
        fontSize: 15,
        color: '#64748B',
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 32,
    },
    highlight: {
        color: '#4F46E5',
        fontWeight: '700',
    },
    stepContainer: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 20,
        width: '100%',
        marginBottom: 32,
    },
    stepTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#475569',
        marginBottom: 16,
        textAlign: 'center',
    },
    stepItem: {
        gap: 12,
    },
    stepText: {
        fontSize: 15,
        color: '#334155',
        marginBottom: 4,
    },
    badge: {
        backgroundColor: '#4F46E5',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: -30, // Stack on top of text
        marginLeft: -26,
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
    },
    bold: {
        fontWeight: '900',
        color: '#1E293B',
        textDecorationLine: 'underline',
    },
    closeBtn: {
        padding: 12,
    },
    closeBtnText: {
        color: '#94A3B8',
        fontSize: 13,
        textDecorationLine: 'underline',
    },
    arrowPointer: {
        position: 'absolute',
        right: 40,
        alignItems: 'center',
    },
    arrowEmoji: {
        fontSize: 40,
        color: '#FBBF24',
        marginBottom: 8,
    },
    arrowText: {
        color: '#fff',
        fontWeight: '800',
        fontSize: 14,
        backgroundColor: '#F59E0B',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    }
});
