import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Alert, ActivityIndicator, Pressable, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView } from 'react-native';
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

    // Step 2: Office
    const [companyName, setCompanyName] = useState('');
    const [slug, setSlug] = useState('');
    const [address, setAddress] = useState('');

    const handleNextStep = async () => {
        if (step === 1) {
            if (!email || !password) {
                Alert.alert('알림', '이메일과 비밀번호를 입력해주세요.');
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
        if (!companyName || !slug) {
            Alert.alert('알림', '오피스 명칭과 전용 주소(슬러그)를 입력해주세요.');
            return;
        }

        setLoading(true);
        try {
            // 1. 슬러그 중복 체크
            const isUnique = await companiesService.checkSlugUnique(slug);
            if (!isUnique) {
                Alert.alert('중복 주소', '이미 사용 중인 전용 주소(슬러그)입니다. 다른 주소를 입력해주세요.');
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
            const company = await companiesService.createCompany(companyName, address, slug);

            // 4. 관리자 프로필(Profile) 생성
            await profilesService.createProfile({
                id: authData.user.id,
                company_id: company.id,
                name: '관리자', // 기본값
                phone: '',      // 추후 입력 가능
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
                <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: 60 }}>
                    <View style={{ marginBottom: 40 }}>
                        <Text style={{ fontSize: 32, fontWeight: '800', color: '#1E293B' }}>오피스 가입</Text>
                        <Text style={{ fontSize: 16, color: '#64748B', marginTop: 8 }}>
                            {step === 1 ? '먼저 관리자 계정을 생성하세요' : '오피스의 정보를 입력해 주세요'}
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
                            <View style={{ height: 4, flex: 1, backgroundColor: step >= 1 ? '#4F46E5' : '#E2E8F0', borderRadius: 2 }} />
                            <View style={{ height: 4, flex: 1, backgroundColor: step >= 2 ? '#4F46E5' : '#E2E8F0', borderRadius: 2 }} />
                        </View>
                    </View>

                    {step === 1 ? (
                        <View style={{ gap: 20 }}>
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
                            <PrimaryButton
                                label="다음 단계로"
                                onPress={handleNextStep}
                                style={{ marginTop: 20, width: '100%', height: 56 }}
                            />
                        </View>
                    ) : (
                        <View style={{ gap: 20 }}>
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
                                <Text style={appStyles.label}>전용 주소 슬러그 (영문)</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 8, paddingLeft: 12 }}>
                                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>postnoti.com/branch/</Text>
                                    <TextInput
                                        style={[appStyles.input, { flex: 1, backgroundColor: 'transparent', borderWidth: 0 }]}
                                        value={slug}
                                        onChangeText={(t) => setSlug(t.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                                        placeholder="seocho"
                                        autoCapitalize="none"
                                    />
                                </View>
                                <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
                                    * 입주사들이 우편함을 확인할 때 사용할 고유 주소입니다.
                                </Text>
                            </View>
                            <View style={appStyles.inputGroup}>
                                <Text style={appStyles.label}>오피스 위치 (주소)</Text>
                                <TextInput
                                    style={appStyles.input}
                                    value={address}
                                    onChangeText={setAddress}
                                    placeholder="오피스의 위치를 입력하세요 (선택)"
                                />
                            </View>

                            {loading ? (
                                <ActivityIndicator size="large" color="#4F46E5" style={{ marginTop: 20 }} />
                            ) : (
                                <View style={{ gap: 12, marginTop: 20 }}>
                                    <PrimaryButton
                                        label="오피스 가입 완료"
                                        onPress={handleSignup}
                                        style={{ width: '100%', height: 56, backgroundColor: '#1E293B' }}
                                    />
                                    <Pressable onPress={() => setStep(1)} style={{ alignItems: 'center', padding: 10 }}>
                                        <Text style={{ color: '#64748B', fontWeight: '600' }}>이전 단계로</Text>
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
