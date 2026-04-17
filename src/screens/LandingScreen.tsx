import React from 'react';
import { View, Text, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Image, Pressable, Keyboard } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LoginScreen } from '../components/auth/LoginScreen';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { appStyles } from '../styles/appStyles';
import { useAppContent } from '../contexts/AppContext';
import { isKakaoTalk, redirectToExternalBrowser } from '../utils/browserDetection';

export const LandingScreen = () => {
    const navigation = useNavigation<any>();
    const { setMode, handleLoginSuccess } = useAppContent();
    const [keyboardVisible, setKeyboardVisible] = React.useState(false);

    React.useEffect(() => {
        if (isKakaoTalk()) {
            redirectToExternalBrowser();
        }

        const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    return (
        <SafeAreaView style={appStyles.flexContainer}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={appStyles.flexContainer}
            >
                <ScrollView
                    style={appStyles.flexContainer}
                    contentContainerStyle={{ paddingBottom: 50 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {isKakaoTalk() && (
                        <View style={{
                            backgroundColor: '#FEE2E2',
                            padding: 12,
                            alignItems: 'center',
                            borderBottomWidth: 1,
                            borderBottomColor: '#F87171'
                        }}>
                            <Text style={{ color: '#991B1B', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
                                ⚠️ 카카오톡 브라우저에서는 알림이 작동하지 않습니다.{"\n"}
                                오른쪽 위 [···] 버튼 클릭 후 [다른 브라우저로 열기]를 해주세요!
                            </Text>
                        </View>
                    )}
                    <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
                        <View style={{ marginBottom: keyboardVisible ? 10 : 30, marginTop: keyboardVisible ? 20 : 40, alignItems: 'center' }}>
                            <Image
                                source={require('../../assets/icon.png')}
                                style={{
                                    width: keyboardVisible ? 100 : 180,
                                    height: keyboardVisible ? 100 : 180,
                                    borderRadius: keyboardVisible ? 24 : 40
                                }}
                                resizeMode="contain"
                            />
                            <Text style={{ fontSize: 15, color: '#475569', fontWeight: '800', marginTop: -16 }}>공유오피스우편알림 - 포스트노티</Text>
                        </View>

                        <View style={appStyles.actionSection}>
                            <View style={[appStyles.loginCardDirect, {
                                elevation: 15,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 10 },
                                shadowOpacity: 0.1,
                                shadowRadius: 20,
                                paddingHorizontal: 30,
                                paddingVertical: keyboardVisible ? 15 : 20,
                                backgroundColor: '#FFFFFF',
                                borderRadius: 30,
                                marginHorizontal: 4
                            }]}>
                                <LoginScreen
                                    onLoginSuccess={async (profile) => {
                                        await handleLoginSuccess(profile);
                                        navigation.replace('AdminHome');
                                    }}
                                    onBack={() => { }}
                                    isEmbedded={true}
                                />
                            </View>

                            <Pressable
                                onPress={() => navigation.navigate('AdminSignup')}
                                style={{ marginTop: 40, alignItems: 'center' }}
                            >
                                <Text style={{ fontSize: 16, color: '#64748B' }}>
                                    아직 계정이 없으신가요?{' '}
                                    <Text style={{ color: '#6366F1', fontWeight: '700', textDecorationLine: 'underline' }}>오피스 등록하기</Text>
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};
