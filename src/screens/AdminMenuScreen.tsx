import React, { useRef } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { supabase } from '../lib/supabase';
import { Modal } from 'react-native';
import { TenantManagement } from '../components/admin/TenantManagement';
import { SenderManagement } from '../components/admin/SenderManagement';
import { tenantsService } from '../services/tenantsService';
import { masterSendersService } from '../services/masterSendersService';
import { notificationService } from '../services/notificationService';
import { AdminTabBar } from '../components/admin/AdminTabBar';

export const AdminMenuScreen = () => {
    const { officeInfo, setOfficeInfo } = useAuth();
    const { setMode } = useUI();

    const tenantMgmtRef = useRef<any>(null);

    const handleLogout = async () => {
        Alert.alert('로그?�웃', '?�말 로그?�웃 ?�시겠습?�까?', [
            { text: '취소', style: 'cancel' },
            {
                text: '로그?�웃',
                style: 'destructive',
                onPress: async () => {
                    await supabase.auth.signOut();
                    setMode('landing');
                }
            }
        ]);
    };

    const copyLink = async () => {
        const url = `https://postnoti-app.vercel.app/view`;
        await Clipboard.setStringAsync(url);
        Alert.alert('복사 ?�료', `?�주???�용 링크 주소가 복사?�었?�니??\n${url}`);
    };

    return (
        <SafeAreaView style={appStyles.safeArea} edges={['top', 'left', 'right']}>
            <AppHeader title="관�?메뉴" onBack={() => setMode('admin_dashboard')} />

            <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 20 }}>
                <View style={[appStyles.bottomSheetHeader, { marginBottom: 15 }]}>
                    <Text style={[appStyles.bottomSheetTitle, { fontSize: 18 }]}>?�피???�정 �?관�?/Text>
                    <Text style={appStyles.bottomSheetSubtitle}>?�하?�는 관�?기능???�택??주세??/Text>
                </View>

                <View style={{ gap: 8 }}>
                    <Pressable
                        onPress={() => setMode('admin_settings')}
                        style={[appStyles.premiumMenuBtn, { padding: 15 }]}
                    >
                        <Ionicons name="person-circle-outline" size={24} color="#4F46E5" style={{ marginRight: 16 }} />
                        <View style={appStyles.menuBtnTextGroup}>
                            <Text style={[appStyles.menuBtnLabel, { color: '#4F46E5' }]}>마이?�이지 / ?�정</Text>
                            <Text style={appStyles.menuBtnDesc}>관리자 ?�보 �??�피??기본 ?�정</Text>
                        </View>
                        <Ionicons name="chevron-forward-outline" size={20} color="#CBD5E1" />
                    </Pressable>

                    <View style={appStyles.menuSeparator} />

                    <Pressable
                        onPress={() => {
                            setMode('admin_notification_settings');
                        }}
                        style={[appStyles.premiumMenuBtn, { padding: 15 }]}
                    >
                        <Ionicons name="chatbubble-ellipses-outline" size={24} color="#1E293B" style={{ marginRight: 16 }} />
                        <View style={appStyles.menuBtnTextGroup}>
                            <Text style={appStyles.menuBtnLabel}>?�림 메시지 ?�정</Text>
                            <Text style={appStyles.menuBtnDesc}>기본 문구 �?빠른 메시지 관�?/Text>
                        </View>
                        <Ionicons name="chevron-forward-outline" size={20} color="#CBD5E1" />
                    </Pressable>

                    <View style={[appStyles.premiumMenuBtn, { backgroundColor: '#F1F5F9', borderStyle: 'dashed', padding: 12 }]}>
                        <Ionicons name="link-outline" size={24} color="#4F46E5" style={{ marginRight: 12 }} />
                        <View style={appStyles.menuBtnTextGroup}>
                            <Text style={[appStyles.menuBtnLabel, { color: '#4F46E5', fontSize: 14 }]}>?�주???�용 링크</Text>
                            <Text style={appStyles.menuBtnDesc} numberOfLines={1}>
                                postnoti-app.vercel.app/view
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
                            <Text style={[appStyles.exitBtnLabel, { fontSize: 14 }]}>로그?�웃</Text>
                            <Text style={appStyles.exitBtnDesc}>?�재 계정?�서 ?�전?�게 ?��?�?/Text>
                        </View>
                    </Pressable>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
            <AdminTabBar />
        </SafeAreaView>
    );
};
