import React from 'react';
import { View, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LoginScreen } from '../components/auth/LoginScreen';
import { appStyles } from '../styles/appStyles';
import { useAppContent } from '../contexts/AppContext';

import { isKakaoTalk, redirectToExternalBrowser } from '../utils/browserDetection';

export const LandingScreen = () => {
    const navigation = useNavigation<any>();
    const { setMode } = useAppContent();

    React.useEffect(() => {
        if (isKakaoTalk()) {
            redirectToExternalBrowser();
        }
    }, []);

    return (
        <View style={appStyles.landingContainer}>
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
            <View style={appStyles.heroContent}>
                <View style={appStyles.premiumLine} />
                <Text style={appStyles.heroTitle}>POSTNOTI</Text>
                <Text style={appStyles.heroSubtitle}>공유오피스를 위한 스마트 우편 관리 시스템</Text>
            </View>

            <View style={appStyles.actionSection}>
                <View style={appStyles.loginCardDirect}>
                    <Text style={appStyles.loginDirectTitle}>관리자 로그인</Text>
                    <LoginScreen
                        onLoginSuccess={() => {
                            // [1:1 구조 개편] 지점 선택 없이 바로 대시보드 진입
                            setMode('admin_dashboard');
                            navigation.replace('AdminDashboard');
                        }}
                        onBack={() => { }}
                        isEmbedded={true}
                    />
                </View>
            </View>
        </View>
    );
};
