import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Image, Pressable, Keyboard, TextInput, ActivityIndicator, Alert, Modal } from 'react-native';
import { LoginScreen } from '../components/auth/LoginScreen';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { appStyles } from '../styles/appStyles';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { useNotifications } from '../contexts/NotificationContext';
import { isKakaoTalk, redirectToExternalBrowser } from '../utils/browserDetection';
import { tenantsService } from '../services/tenantsService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

export const LandingScreen = () => {
    const { handleLoginSuccess } = useAuth();
    const { expoPushToken, webPushToken } = useNotifications();
    const { setMode, setBrandingCompany } = useUI();
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    
    // 입주자 글로벌 로그인 상태 (관리자 앱이면 false, 아니면 true)
    const appName = Constants.expoConfig?.name || '스마트우편알림';
    const isAdminApp = appName === '포스트노티';
    const [viewState, setViewState] = useState<'selection' | 'tenant' | 'admin'>('selection');
    const [tenantPhone, setTenantPhone] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [showSignupModal, setShowSignupModal] = useState(false);
    const [signupPassword, setSignupPassword] = useState('');

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

    const handleTenantPhoneChange = (text: string) => {
        let cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned.length === 0) {
            setTenantPhone('');
            return;
        }
        if (!cleaned.startsWith('010') && cleaned.length > 0) {
            if (!cleaned.startsWith('01') && !cleaned.startsWith('0')) {
                cleaned = '010' + cleaned;
            }
        }
        let formatted = '';
        if (cleaned.length <= 3) {
            formatted = cleaned;
        } else if (cleaned.length <= 7) {
            formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
        } else if (cleaned.length <= 10) {
            formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        } else {
            const truncated = cleaned.slice(0, 11);
            formatted = `${truncated.slice(0, 3)}-${truncated.slice(3, 7)}-${truncated.slice(7)}`;
        }
        setTenantPhone(formatted);
    };

    const handleGlobalTenantLogin = async () => {
        const fullPhone = tenantPhone.replace(/[^0-9]/g, '');
        if (fullPhone.length < 10) {
            Alert.alert('알림', '정확한 휴대전화 번호를 입력해주세요.');
            return;
        }

        setIsSearching(true);
        try {
            const match = await tenantsService.globalFindTenantByPhone(fullPhone);
            if (!match) {
                Alert.alert('알림', '등록되지 않은 번호입니다.\n관리자에게 초대를 요청해주세요.');
                return;
            }

            // PWA 홈 화면 복귀를 대비해 저장
            const magicUrl = `https://postn.kr/view?m=${match.company_id}&p=${match.tenant_id}`;
            await AsyncStorage.setItem('last_tenant_url', magicUrl);

            // UI Context 업데이트 후 입주자 화면으로 전환
            setBrandingCompany({
                id: match.company_id,
                name: match.company_name,
                magicId: match.company_id,
                targetTenantId: match.tenant_id
            } as any);
            setMode('tenant_login');

        } catch (e) {
            console.error(e);
            Alert.alert('오류', '조회 중 문제가 발생했습니다.');
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <SafeAreaView style={appStyles.flexContainer}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={appStyles.flexContainer}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    style={appStyles.flexContainer}
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: keyboardVisible ? 200 : 20 }}
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
                                source={require('../../assets/logo.png')}
                                style={{
                                    width: keyboardVisible ? 60 : 90,
                                    height: keyboardVisible ? 60 : 90,
                                    borderRadius: keyboardVisible ? 15 : 24
                                }}
                                resizeMode="contain"
                            />
                            <Text style={{ fontSize: 16, color: '#475569', fontWeight: '800', marginTop: 15 }}>
                                스마트우편알림 - <Text style={{ fontSize: 14 }}>postnoti</Text>
                                {isAdminApp && viewState !== 'tenant' && <Text style={{ color: '#4F46E5' }}> (관리자)</Text>}
                            </Text>
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
                                {viewState === 'selection' ? (
                                    <View style={{ gap: 15 }}>
                                        <Text style={{ textAlign: 'center', color: '#64748B', fontWeight: '700', marginBottom: 5 }}>어떤 권한으로 접속하시나요?</Text>
                                        
                                        <View style={{ flexDirection: 'row', gap: 12 }}>
                                            <Pressable 
                                                style={{ flex: 1, backgroundColor: '#EEF2FF', paddingVertical: 25, paddingHorizontal: 10, borderRadius: 20, alignItems: 'center', borderWidth: 2, borderColor: '#C7D2FE' }}
                                                onPress={() => setViewState('tenant')}
                                            >
                                                <Text style={{ fontSize: 36, marginBottom: 12 }}>🏠</Text>
                                                <Text style={{ fontSize: 16, fontWeight: '800', color: '#4F46E5', marginBottom: 6 }}>입주자 우편함</Text>
                                                <Text style={{ fontSize: 11, color: '#64748B', textAlign: 'center' }}>휴대전화 번호 조회</Text>
                                            </Pressable>
                                            
                                            <Pressable 
                                                style={{ flex: 1, backgroundColor: '#F8FAFC', paddingVertical: 25, paddingHorizontal: 10, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' }}
                                                onPress={() => setViewState('admin')}
                                            >
                                                <Text style={{ fontSize: 36, marginBottom: 12 }}>🏢</Text>
                                                <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 6 }}>관리자 전용</Text>
                                                <Text style={{ fontSize: 11, color: '#64748B', textAlign: 'center' }}>오피스 매니저 로그인</Text>
                                            </Pressable>
                                        </View>
                                    </View>
                                ) : viewState === 'tenant' ? (
                                    <View>
                                        <Pressable onPress={() => setViewState('selection')} style={{ marginBottom: 15 }}>
                                            <Text style={{ color: '#64748B', fontWeight: '700' }}>← 이전으로</Text>
                                        </Pressable>
                                        <Text style={{ fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 20, textAlign: 'center' }}>입주자 번호 로그인</Text>
                                        <View style={{ marginBottom: 20 }}>
                                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748B', marginBottom: 8 }}>등록된 휴대전화 번호</Text>
                                            <TextInput
                                                style={{
                                                    backgroundColor: '#F8FAFC',
                                                    borderWidth: 1,
                                                    borderColor: '#E2E8F0',
                                                    borderRadius: 16,
                                                    paddingHorizontal: 18,
                                                    height: 56,
                                                    fontSize: 16,
                                                    color: '#1E293B'
                                                }}
                                                value={tenantPhone}
                                                onChangeText={handleTenantPhoneChange}
                                                placeholder="010-0000-0000"
                                                placeholderTextColor="#94A3B8"
                                                keyboardType="number-pad"
                                                maxLength={13}
                                            />
                                        </View>
                                        <PrimaryButton
                                            label={isSearching ? "확인 중..." : "내 우편함 열기"}
                                            onPress={handleGlobalTenantLogin}
                                            loading={isSearching}
                                            style={{ backgroundColor: '#4F46E5', borderRadius: 16, height: 56 }}
                                        />
                                    </View>
                                ) : (
                                    <View>
                                        <Pressable onPress={() => setViewState('selection')} style={{ marginBottom: 15 }}>
                                            <Text style={{ color: '#64748B', fontWeight: '700' }}>← 이전으로</Text>
                                        </Pressable>
                                        <LoginScreen
                                            onLoginSuccess={async (profile) => {
                                                await handleLoginSuccess(profile, expoPushToken, webPushToken);
                                                setMode('admin_dashboard');
                                            }}
                                            onBack={() => { }}
                                            isEmbedded={true}
                                        />
                                    </View>
                                )}
                            </View>

                            {viewState === 'admin' && (
                                <Pressable
                                    onPress={() => setShowSignupModal(true)}
                                    style={{ marginTop: 40, alignItems: 'center' }}
                                >
                                    <Text style={{ fontSize: 16, color: '#64748B' }}>
                                        아직 계정이 없으신가요?{' '}
                                        <Text style={{ color: '#6366F1', fontWeight: '700', textDecorationLine: 'underline' }}>오피스 등록하기</Text>
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                    {!keyboardVisible && (
                        <View style={{ alignItems: 'center', paddingBottom: 20 }}>
                            <Text style={{ color: '#CBD5E1', fontSize: 13, fontWeight: '600' }}>postn.kr</Text>
                        </View>
                    )}
                </ScrollView>

                {/* 베타 테스트 중 오피스 가입을 제한하기 위한 비밀번호 모달 */}
                <Modal visible={showSignupModal} transparent={true} animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                        <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 16, width: '100%', maxWidth: 400 }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 12 }}>베타 테스터 인증</Text>
                            <Text style={{ fontSize: 14, color: '#64748B', marginBottom: 20, lineHeight: 20 }}>
                                현재 오피스 등록은 사전 등록된 베타 테스터에게만 허용됩니다. 인증 코드를 입력해주세요.
                            </Text>
                            <TextInput
                                style={{
                                    backgroundColor: '#F1F5F9',
                                    borderWidth: 1,
                                    borderColor: '#E2E8F0',
                                    borderRadius: 12,
                                    paddingHorizontal: 16,
                                    height: 50,
                                    fontSize: 16,
                                    marginBottom: 20
                                }}
                                placeholder="인증 코드 입력"
                                secureTextEntry
                                value={signupPassword}
                                onChangeText={setSignupPassword}
                            />
                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                <Pressable
                                    style={{ flex: 1, height: 48, backgroundColor: '#F1F5F9', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}
                                    onPress={() => {
                                        setShowSignupModal(false);
                                        setSignupPassword('');
                                    }}
                                >
                                    <Text style={{ color: '#475569', fontWeight: '600' }}>취소</Text>
                                </Pressable>
                                <Pressable
                                    style={{ flex: 1, height: 48, backgroundColor: '#4F46E5', borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}
                                    onPress={() => {
                                        if (signupPassword === 'wait2894') {
                                            setShowSignupModal(false);
                                            setSignupPassword('');
                                            setMode('admin_signup');
                                        } else {
                                            Alert.alert('인증 실패', '올바른 인증 코드가 아닙니다.');
                                        }
                                    }}
                                >
                                    <Text style={{ color: '#fff', fontWeight: '600' }}>확인</Text>
                                </Pressable>
                            </View>
                        </View>
                    </View>
                </Modal>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};
