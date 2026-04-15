import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, ActivityIndicator, Pressable, Image, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { companiesService } from '../services/companiesService';
import { profilesService } from '../services/profilesService';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { appStyles } from '../styles/appStyles';
import { useAppContent } from '../contexts/AppContext';

export const AdminSignupScreen = () => {
    const navigation = useNavigation<any>();
    const { setMode, setOfficeInfo } = useAppContent();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    // Step 1: Account
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Step 2: Office & Manager Info
    const [companyName, setCompanyName] = useState('');
    const [businessNumber, setBusinessNumber] = useState('');
    const [managerName, setManagerName] = useState('');
    const [phone, setPhone] = useState('');
    const [slug, setSlug] = useState('');

    const [isSlugChecked, setIsSlugChecked] = useState(false);
    const [isSlugChecking, setIsSlugChecking] = useState(false);

    const formatBusinessNumber = (text: string) => {
        const cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned.length <= 3) return cleaned;
        if (cleaned.length <= 5) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 10)}`;
    };

    const formatPhone = (text: string) => {
        const cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned.length <= 3) return cleaned;
        if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;
    };

    const handleCheckSlug = async () => {
        if (!slug || slug.length < 2) {
            Alert.alert('알림', '전용 주소를 2자 이상 입력해주세요.');
            return;
        }
        setIsSlugChecking(true);
        try {
            const isUnique = await companiesService.checkSlugUnique(slug);
            if (isUnique) {
                setIsSlugChecked(true);
                Alert.alert('확인 완료', '사용 가능한 주소입니다.');
            } else {
                setIsSlugChecked(false);
                Alert.alert('중복 주소', '이미 사용 중인 주소입니다. 다른 주소를 입력해주세요.');
            }
        } catch (error) {
            Alert.alert('오류', '주소 중복 확인 중 문제가 발생했습니다.');
        } finally {
            setIsSlugChecking(false);
        }
    };

    const handleNextStep = async () => {
        if (step === 1) {
            if (!email || !password || !confirmPassword) {
                Alert.alert('알림', '이메일과 비밀번호 정보를 모두 입력해주세요.');
                return;
            }
            if (password !== confirmPassword) {
                Alert.alert('알림', '비밀번호가 일치하지 않습니다.');
                return;
            }
            if (password.length < 6) {
                Alert.alert('알림', '비밀번호는 최소 6자리 이상이어야 합니다.');
                return;
            }
            setStep(2);
        }
    };

    const handleSignup = async () => {
        if (!companyName || !businessNumber || !managerName || !phone || !slug) {
            Alert.alert('알림', '오피스 정보와 관리자 정보를 모두 입력해주세요.');
            return;
        }

        if (!isSlugChecked) {
            Alert.alert('알림', '오피스 전용 주소 중복 확인을 먼저 진행해주세요.');
            return;
        }

        setLoading(true);
        try {
            // 2중 체크 (혹시 검증 후 그새 누가 썼을 수도 있으니)
            const isUnique = await companiesService.checkSlugUnique(slug);
            if (!isUnique) {
                setIsSlugChecked(false);
                Alert.alert('중복 주소', '그 사이 주소가 사용되었습니다. 다른 주소로 변경해주세요.');
                setLoading(false);
                return;
            }

            // 2. Auth 회원가입
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });
            if (authError) throw authError;
            if (!authData.user) throw new Error('계정 생성에 실패했습니다.');

            // 3. 오피스(Company) 생성
            const company = await companiesService.createCompany(companyName, '', slug, businessNumber);

            // 4. 관리자 프로필(Profile) 생성
            await profilesService.createProfile({
                id: authData.user.id,
                company_id: company.id,
                name: managerName,
                phone: phone,
                role: 'admin',
                is_active: true
            });

            // 5. 완료 처리
            setOfficeInfo(company);
            setMode('admin_dashboard');
            Alert.alert('가입 완료', '포스트노티 오피스 가입이 완료되었습니다!', [
                { text: '대시보드로 이동', onPress: () => navigation.replace('AdminDashboard') }
            ]);

        } catch (error: any) {
            Alert.alert('가입 실패', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={appStyles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={{ flex: 1, backgroundColor: '#FFFFFF' }}
                    contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: 60 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={{ marginBottom: 40 }}>
                        <Text style={{ fontSize: 28, fontWeight: '800', color: '#1E293B', textAlign: 'center' }}>오피스 등록하기</Text>
                        <Text style={{ fontSize: 15, color: '#64748B', marginTop: 8, textAlign: 'center' }}>
                            {step === 1 ? '관리자 계정을 먼저 생성해 주세요' : '운영하실 오피스 정보를 입력해 주세요'}
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, paddingHorizontal: 40 }}>
                            <View style={{ height: 6, flex: 1, backgroundColor: step >= 1 ? '#6366F1' : '#F1F5F9', borderRadius: 3 }} />
                            <View style={{ height: 6, flex: 1, backgroundColor: step >= 2 ? '#6366F1' : '#F1F5F9', borderRadius: 3 }} />
                        </View>
                    </View>

                    {step === 1 ? (
                        <View style={[appStyles.loginCardDirect, {
                            elevation: 10,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.08,
                            shadowRadius: 12,
                            padding: 24,
                            backgroundColor: '#FFFFFF',
                            borderRadius: 24,
                            marginHorizontal: 4
                        }]}>
                            <View style={appStyles.inputGroup}>
                                <Text style={appStyles.label}>이메일 주소</Text>
                                <TextInput
                                    style={appStyles.input}
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="admin@example.com"
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                            <View style={appStyles.inputGroup}>
                                <Text style={appStyles.label}>비밀번호 (6자리 이상)</Text>
                                <TextInput
                                    style={appStyles.input}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="******"
                                    secureTextEntry
                                />
                            </View>
                            <View style={appStyles.inputGroup}>
                                <Text style={appStyles.label}>비밀번호 확인</Text>
                                <TextInput
                                    style={appStyles.input}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="비밀번호를 한 번 더 입력하세요"
                                    secureTextEntry
                                />
                            </View>
                            <PrimaryButton
                                label="다음 단계로 (오피스 정보 입력)"
                                onPress={handleNextStep}
                                style={{ marginTop: 20, width: '100%', height: 56, backgroundColor: '#6366F1' }}
                            />
                        </View>
                    ) : (
                        <View style={[appStyles.loginCardDirect, {
                            elevation: 10,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.08,
                            shadowRadius: 12,
                            padding: 24,
                            backgroundColor: '#FFFFFF',
                            borderRadius: 24,
                            marginHorizontal: 4
                        }]}>
                            <View style={appStyles.inputGroup}>
                                <Text style={appStyles.label}>오피스 명칭 (예: 포스트노티 종로점)</Text>
                                <TextInput
                                    style={appStyles.input}
                                    value={companyName}
                                    onChangeText={setCompanyName}
                                    placeholder="오피스 이름을 입력하세요"
                                />
                            </View>
                            <View style={appStyles.inputGroup}>
                                <Text style={appStyles.label}>사업자 등록 번호</Text>
                                <TextInput
                                    style={appStyles.input}
                                    value={businessNumber}
                                    onChangeText={(t) => setBusinessNumber(formatBusinessNumber(t))}
                                    placeholder="000-00-00000"
                                    keyboardType="numeric"
                                    maxLength={12}
                                />
                            </View>

                            <View style={appStyles.inputGroup}>
                                <Text style={appStyles.label}>관리자 성함 (실명)</Text>
                                <TextInput
                                    style={appStyles.input}
                                    value={managerName}
                                    onChangeText={setManagerName}
                                    placeholder="홍길동"
                                />
                            </View>

                            <View style={appStyles.inputGroup}>
                                <Text style={appStyles.label}>관리자 연락처</Text>
                                <TextInput
                                    style={appStyles.input}
                                    value={phone}
                                    onChangeText={(t) => setPhone(formatPhone(t))}
                                    placeholder="010-1234-5678"
                                    keyboardType="phone-pad"
                                    maxLength={13}
                                />
                            </View>

                            <View style={appStyles.inputGroup}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Text style={appStyles.label}>오피스 전용 접속 주소 (영문/숫자)</Text>
                                    <Pressable
                                        onPress={handleCheckSlug}
                                        style={{ backgroundColor: isSlugChecked ? '#10B981' : '#6366F1', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 }}
                                        disabled={isSlugChecking}
                                    >
                                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                                            {isSlugChecking ? '확인 중...' : isSlugChecked ? '확인 완료' : '중복 확인'}
                                        </Text>
                                    </Pressable>
                                </View>
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: '#F1F5F9',
                                    borderRadius: 8,
                                    paddingLeft: 12,
                                    borderWidth: 1,
                                    borderColor: isSlugChecked ? '#10B981' : 'transparent'
                                }}>
                                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>postnoti-app-two.vercel.app/</Text>
                                    <TextInput
                                        style={[appStyles.input, { flex: 1, backgroundColor: 'transparent', borderWidth: 0 }]}
                                        value={slug}
                                        onChangeText={(t) => {
                                            setSlug(t.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                                            setIsSlugChecked(false); // 주소 바뀌면 다시 체크해야 함
                                        }}
                                        placeholder="지점명 (예: seocho)"
                                        autoCapitalize="none"
                                    />
                                </View>
                                {isSlugChecked && (
                                    <Text style={{ fontSize: 11, color: '#10B981', marginTop: 4 }}>사용 가능한 주소입니다.</Text>
                                )}
                            </View>

                            {loading ? (
                                <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 20 }} />
                            ) : (
                                <View style={{ gap: 12, marginTop: 24 }}>
                                    <PrimaryButton
                                        label="오피스 가입 완료"
                                        onPress={handleSignup}
                                        style={{ width: '100%', height: 56, backgroundColor: '#1E293B' }}
                                    />
                                    <Pressable onPress={() => setStep(1)} style={{ alignItems: 'center', padding: 10 }}>
                                        <Text style={{ color: '#94A3B8', fontWeight: '600' }}>이전 단계로 돌아가기</Text>
                                    </Pressable>
                                </View>
                            )}
                        </View>
                    )}

                    <Pressable
                        onPress={() => navigation.goBack()}
                        style={{ marginTop: 40, alignItems: 'center' }}
                    >
                        <Text style={{ color: '#94A3B8', fontSize: 14 }}>이미 가입하셨나요? 로그인하기</Text>
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};
