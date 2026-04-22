import React, { useRef } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useAppContent } from '../contexts/AppContext';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { supabase } from '../lib/supabase';
import { Modal } from 'react-native';
import { TenantManagement } from '../components/admin/TenantManagement';
import { SenderManagement } from '../components/admin/SenderManagement';
import { tenantsService } from '../services/tenantsService';
import { masterSendersService } from '../services/masterSendersService';
import { notificationService } from '../services/notificationService';

export const AdminMenuScreen = () => {
    const navigation = useNavigation<any>();
    const {
        officeInfo,
        setProfiles, setMasterSenders
    } = useAppContent();

    const tenantMgmtRef = useRef<any>(null);

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
        const url = `https://postnoti-app-two.vercel.app/view`;
        await Clipboard.setStringAsync(url);
        Alert.alert('복사 완료', `입주자 전용 링크 주소가 복사되었습니다.\n${url}`);
    };

    return (
        <SafeAreaView style={appStyles.safeArea} edges={['top', 'left', 'right']}>
            <AppHeader title="관리 메뉴" onBack={() => navigation.goBack()} />

            <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 20 }}>
                <View style={[appStyles.bottomSheetHeader, { marginBottom: 15 }]}>
                    <Text style={[appStyles.bottomSheetTitle, { fontSize: 18 }]}>오피스 설정 및 관리</Text>
                    <Text style={appStyles.bottomSheetSubtitle}>원하시는 관리 기능을 선택해 주세요</Text>
                </View>

                <View style={{ gap: 8 }}>
                    <Pressable
                        onPress={() => navigation.navigate('AdminSettings')}
                        style={[appStyles.premiumMenuBtn, { padding: 15 }]}
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
                            navigation.navigate('AdminSenders');
                        }}
                        style={[appStyles.premiumMenuBtn, { padding: 15 }]}
                    >
                        <Ionicons name="key-outline" size={24} color="#1E293B" style={{ marginRight: 16 }} />
                        <View style={appStyles.menuBtnTextGroup}>
                            <Text style={appStyles.menuBtnLabel}>발신처 키워드 설정</Text>
                            <Text style={appStyles.menuBtnDesc}>자동 인식을 위한 필터링 키워드 관리</Text>
                        </View>
                        <Ionicons name="chevron-forward-outline" size={20} color="#CBD5E1" />
                    </Pressable>

                    <View style={[appStyles.premiumMenuBtn, { backgroundColor: '#F1F5F9', borderStyle: 'dashed', padding: 12 }]}>
                        <Ionicons name="link-outline" size={24} color="#4F46E5" style={{ marginRight: 12 }} />
                        <View style={appStyles.menuBtnTextGroup}>
                            <Text style={[appStyles.menuBtnLabel, { color: '#4F46E5', fontSize: 14 }]}>입주자 전용 링크</Text>
                            <Text style={appStyles.menuBtnDesc} numberOfLines={1}>
                                postnoti-app-two.vercel.app/view
                            </Text>
                        </View>
                        <Pressable
                            onPress={copyLink}
                            style={{ backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' }}
                        >
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>복사</Text>
                        </Pressable>
                    </View>

                    <View style={appStyles.menuSeparator} />

                    <Pressable
                        onPress={handleLogout}
                        style={[appStyles.premiumExitBtn, { padding: 15 }]}
                    >
                        <Ionicons name="log-out-outline" size={22} color="#E11D48" style={{ marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={[appStyles.exitBtnLabel, { fontSize: 14 }]}>로그아웃</Text>
                            <Text style={appStyles.exitBtnDesc}>현재 계정에서 안전하게 나가기</Text>
                        </View>
                    </Pressable>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </SafeAreaView>
    );
};
