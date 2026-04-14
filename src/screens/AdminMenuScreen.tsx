import React from 'react';
import { View, Text, Pressable, ScrollView, SafeAreaView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useAppContent } from '../contexts/AppContext';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { supabase } from '../lib/supabase';

export const AdminMenuScreen = () => {
    const navigation = useNavigation<any>();
    const { officeInfo } = useAppContent();

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

    const copyLink = async () => {
        const url = `https://postnoti-app.vercel.app/branch/${officeInfo?.slug}`;
        await Clipboard.setStringAsync(url);
        Alert.alert('복사 완료', `입주자 전용 링크가 복사되었습니다.\n${url}`);
    };

    return (
        <SafeAreaView style={appStyles.safeArea}>
            <AppHeader title="관리 메뉴" onBack={() => navigation.goBack()} />

            <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 20 }}>
                <View style={appStyles.bottomSheetHeader}>
                    <Text style={appStyles.bottomSheetTitle}>오피스 설정 및 관리</Text>
                    <Text style={appStyles.bottomSheetSubtitle}>원하시는 관리 기능을 선택해 주세요</Text>
                </View>

                <View style={{ gap: 12 }}>
                    <Pressable
                        onPress={() => navigation.navigate('AdminSettings')}
                        style={appStyles.premiumMenuBtn}
                    >
                        <Ionicons name="person-circle-outline" size={24} color="#4F46E5" style={{ marginRight: 16 }} />
                        <View style={appStyles.menuBtnTextGroup}>
                            <Text style={[appStyles.menuBtnLabel, { color: '#4F46E5' }]}>마이페이지 / 설정</Text>
                            <Text style={appStyles.menuBtnDesc}>관리자 정보 및 오피스 기본 설정</Text>
                        </View>
                        <Ionicons name="chevron-forward-outline" size={20} color="#CBD5E1" />
                    </Pressable>

                    <View style={appStyles.menuSeparator} />

                    <Pressable
                        onPress={() => {
                            // Tenant Management 는 현재 Dashboard에서 Modal로 띄우고 있으나, 
                            // 흐름상 Dashboard로 돌아가서 해당 Modal을 띄우는 것보다
                            // 독립적인 화면으로 분리하는 것이 좋습니다.
                            // 일단 현재는 Dashboard의 상태를 바꾸는 식으로 연동할 수도 있으나
                            // 사용자 피드백(계속 메뉴에 머무르기)을 위해 전용 파라미터를 넘겨 Dashboard로 복귀시킵니다.
                            navigation.navigate('AdminDashboard', { openTenantMgmt: true });
                        }}
                        style={appStyles.premiumMenuBtn}
                    >
                        <Ionicons name="business-outline" size={24} color="#1E293B" style={{ marginRight: 16 }} />
                        <View style={appStyles.menuBtnTextGroup}>
                            <Text style={appStyles.menuBtnLabel}>입주사 데이터 관리</Text>
                            <Text style={appStyles.menuBtnDesc}>입주사 등록, 수정 및 거주 상태 관리</Text>
                        </View>
                        <Ionicons name="chevron-forward-outline" size={20} color="#CBD5E1" />
                    </Pressable>

                    <Pressable
                        onPress={() => {
                            navigation.navigate('AdminDashboard', { openSenderMgmt: true });
                        }}
                        style={appStyles.premiumMenuBtn}
                    >
                        <Ionicons name="key-outline" size={24} color="#1E293B" style={{ marginRight: 16 }} />
                        <View style={appStyles.menuBtnTextGroup}>
                            <Text style={appStyles.menuBtnLabel}>발신처 키워드 설정</Text>
                            <Text style={appStyles.menuBtnDesc}>자동 인식을 위한 필터링 키워드 관리</Text>
                        </View>
                        <Ionicons name="chevron-forward-outline" size={20} color="#CBD5E1" />
                    </Pressable>

                    <View style={[appStyles.premiumMenuBtn, { backgroundColor: '#F1F5F9', borderStyle: 'dashed' }]}>
                        <Ionicons name="link-outline" size={24} color="#4F46E5" style={{ marginRight: 16 }} />
                        <View style={appStyles.menuBtnTextGroup}>
                            <Text style={[appStyles.menuBtnLabel, { color: '#4F46E5' }]}>입주자 전용 링크</Text>
                            <Text style={appStyles.menuBtnDesc} numberOfLines={1}>
                                branch/{officeInfo?.slug}
                            </Text>
                        </View>
                        <Pressable
                            onPress={copyLink}
                            style={{ backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}
                        >
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B' }}>복사</Text>
                        </Pressable>
                    </View>

                    <View style={appStyles.menuSeparator} />

                    <Pressable
                        onPress={handleLogout}
                        style={appStyles.premiumExitBtn}
                    >
                        <Ionicons name="log-out-outline" size={22} color="#E11D48" style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={appStyles.exitBtnLabel}>로그아웃</Text>
                            <Text style={appStyles.exitBtnDesc}>현재 계정에서 안전하게 나가기</Text>
                        </View>
                    </Pressable>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};
