import React from 'react';
import { View, Text, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LoginScreen } from '../components/auth/LoginScreen';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { appStyles } from '../styles/appStyles';
import { useAppContent } from '../contexts/AppContext';
import { isKakaoTalk, redirectToExternalBrowser } from '../utils/browserDetection';

export const LandingScreen = () => {
    const navigation = useNavigation<any>();
    const { setMode, handleLoginSuccess } = useAppContent();

    React.useEffect(() => {
        if (isKakaoTalk()) {
            redirectToExternalBrowser();
        }
    }, []);

    return (
        <SafeAreaView style={appStyles.flexContainer}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={appStyles.flexContainer}
            >
                <ScrollView style={appStyles.flexContainer} contentContainerStyle={{ paddingBottom: 50 }}>
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
                    <View style={{ flex: 1, padding: 24, justifyContent: 'center' }}>
                        <View style={{ marginBottom: 50, marginTop: 40, alignItems: 'center' }}>
                            <Text style={{ fontSize: 42, fontWeight: '900', color: '#1E293B', letterSpacing: -1.5 }}>POSTNOTI</Text>
                            <View style={{ height: 3, width: 24, backgroundColor: '#4F46E5', marginTop: 12, borderRadius: 1.5 }} />
                        </View>

                        <View style={appStyles.actionSection}>
                            <View style={[appStyles.loginCardDirect, { elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 }]}>
                                <Text style={[appStyles.loginDirectTitle, { textAlign: 'center', marginBottom: 25 }]}>ADMIN LOGIN</Text>
                                <LoginScreen
                                    onLoginSuccess={async (profile) => {
                                        await handleLoginSuccess(profile);
                                        navigation.replace('AdminDashboard');
                                    }}
                                    onBack={() => { }}
                                    isEmbedded={true}
                                />
                                <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 24 }} />
                                <PrimaryButton
                                    label="Join Office"
                                    onPress={() => navigation.navigate('AdminSignup')}
                                    style={{ width: '100%', backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#4F46E5', height: 56 }}
                                    textStyle={{ color: '#4F46E5', fontWeight: '800' }}
                                />
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};
