import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Alert, ActivityIndicator, Pressable, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { companiesService } from '../services/companiesService';
import { profilesService } from '../services/profilesService';
import { useAppContent } from '../contexts/AppContext';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { PrimaryButton } from '../components/common/PrimaryButton';
import Ionicons from '@expo/vector-icons/Ionicons';

export const AdminSettingsScreen = () => {
    const navigation = useNavigation<any>();
    const { officeInfo, setOfficeInfo } = useAppContent();
    const [loading, setLoading] = useState(false);
    const [adminProfile, setAdminProfile] = useState<any>(null);
    const [authEmail, setAuthEmail] = useState('');

    // Form States
    const [adminName, setAdminName] = useState('');
    const [adminPhone, setAdminPhone] = useState('');
    const [officeName, setOfficeName] = useState('');
    const [officeAddress, setOfficeAddress] = useState('');
    const [businessNumber, setBusinessNumber] = useState('');
    const [officeContact, setOfficeContact] = useState('');

    useEffect(() => {
        loadAdminData();
    }, []);

    const loadAdminData = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setAuthEmail(user.email || '');
                const profile = await profilesService.getProfileById(user.id);
                setAdminProfile(profile);
                setAdminName(profile.name || '');
                setAdminPhone(profile.phone || '');
            }
            if (officeInfo) {
                setOfficeName(officeInfo.name || '');
                setOfficeAddress(officeInfo.address || '');
                setBusinessNumber(officeInfo.business_number || '');
                setOfficeContact(officeInfo.contact_phone || '');
            }
        } catch (error) {
            console.error('Failed to load admin data', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!adminName || !officeName) {
            Alert.alert('알림', '관리자 이름과 오피스 이름은 필수입니다.');
            return;
        }

        setLoading(true);
        try {
            // 1. 프로필 업데이트
            if (adminProfile?.id) {
                await profilesService.updateProfile(adminProfile.id, {
                    name: adminName,
                    phone: adminPhone
                });
            }

            // 2. 오피스 업데이트
            if (officeInfo?.id) {
                const updatedOffice = await companiesService.updateCompany(officeInfo.id, {
                    name: officeName,
                    address: officeAddress,
                    business_number: businessNumber,
                    contact_phone: officeContact
                });
                setOfficeInfo(updatedOffice);
            }

            Alert.alert('성공', '정보가 수정되었습니다.');
        } catch (error: any) {
            Alert.alert('오류', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert('로그아웃', '정말 로그아웃 하시겠습니까?', [
            { text: '취소', style: 'cancel' },
            {
                text: '로그아웃',
                style: 'destructive',
                onPress: async () => {
                    await supabase.auth.signOut();
                    navigation.replace('Landing');
                }
            }
        ]);
    };

    return (
        <SafeAreaView style={appStyles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <AppHeader title="마이페이지 / 설정" onBack={() => navigation.goBack()} />

                <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
                    {/* 관리자 프로필 섹션 */}
                    <View style={appStyles.settingsCard}>
                        <View style={appStyles.settingsCardHeader}>
                            <Ionicons name="person-circle" size={24} color="#4F46E5" />
                            <Text style={appStyles.settingsCardTitle}>관리자 계정 설정</Text>
                        </View>

                        <View style={appStyles.inputGroup}>
                            <Text style={appStyles.label}>성함</Text>
                            <TextInput
                                style={appStyles.input}
                                value={adminName}
                                onChangeText={setAdminName}
                                placeholder="성함을 입력하세요"
                            />
                        </View>

                        <View style={appStyles.inputGroup}>
                            <Text style={appStyles.label}>연락처</Text>
                            <TextInput
                                style={appStyles.input}
                                value={adminPhone}
                                onChangeText={setAdminPhone}
                                placeholder="010-0000-0000"
                                keyboardType="phone-pad"
                            />
                        </View>

                        <View style={[appStyles.inputGroup, { marginBottom: 0 }]}>
                            <Text style={appStyles.label}>계정 이메일</Text>
                            <View style={[appStyles.input, { backgroundColor: '#F1F5F9', justifyContent: 'center' }]}>
                                <Text style={{ color: '#64748B' }}>{authEmail || '불러오는 중...'}</Text>
                            </View>
                        </View>
                    </View>

                    {/* 오피스 정보 섹션 */}
                    <View style={appStyles.settingsCard}>
                        <View style={appStyles.settingsCardHeader}>
                            <Ionicons name="business" size={24} color="#1E293B" />
                            <Text style={appStyles.settingsCardTitle}>오피스 상세 관리</Text>
                        </View>

                        <View style={appStyles.inputGroup}>
                            <Text style={appStyles.label}>오피스 명칭</Text>
                            <TextInput
                                style={appStyles.input}
                                value={officeName}
                                onChangeText={setOfficeName}
                                placeholder="오피스 이름을 입력하세요"
                            />
                        </View>

                        <View style={appStyles.inputGroup}>
                            <Text style={appStyles.label}>상세 주소</Text>
                            <TextInput
                                style={appStyles.input}
                                value={officeAddress}
                                onChangeText={setOfficeAddress}
                                placeholder="상세 주소를 입력하세요"
                            />
                        </View>

                        <View style={appStyles.inputGroup}>
                            <Text style={appStyles.label}>사업자 등록번호</Text>
                            <TextInput
                                style={appStyles.input}
                                value={businessNumber}
                                onChangeText={setBusinessNumber}
                                placeholder="000-00-00000"
                                keyboardType="numbers-and-punctuation"
                            />
                        </View>

                        <View style={appStyles.inputGroup}>
                            <Text style={appStyles.label}>오피스 대표 연락처</Text>
                            <TextInput
                                style={appStyles.input}
                                value={officeContact}
                                onChangeText={setOfficeContact}
                                placeholder="02-0000-0000"
                                keyboardType="phone-pad"
                            />
                        </View>

                        <View style={[appStyles.inputGroup, { marginBottom: 0 }]}>
                            <Text style={appStyles.label}>전용 링크 (URL 슬러그)</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingLeft: 14 }}>
                                <Text style={{ color: '#94A3B8', fontSize: 13 }}>branch/</Text>
                                <TextInput
                                    style={[appStyles.input, { flex: 1, backgroundColor: 'transparent', borderWidth: 0, color: '#94A3B8', paddingLeft: 4 }]}
                                    value={officeInfo?.slug}
                                    editable={false}
                                />
                                <Ionicons name="lock-closed" size={14} color="#CBD5E1" style={{ marginRight: 14 }} />
                            </View>
                        </View>
                    </View>

                    <PrimaryButton
                        label="설정 저장하기"
                        onPress={handleSave}
                        loading={loading}
                        style={{ marginBottom: 12, height: 56, borderRadius: 16 }}
                    />

                    <Pressable
                        onPress={handleLogout}
                        style={appStyles.logoutBtn}
                    >
                        <Ionicons name="log-out-outline" size={20} color="#E11D48" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#E11D48', fontWeight: '800', fontSize: 15 }}>로그아웃</Text>
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};
