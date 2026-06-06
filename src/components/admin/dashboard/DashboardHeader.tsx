import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { appStyles } from '../../../styles/appStyles';
import { useUI } from '../../../contexts/UIContext';
import { useNotifications } from '../../../contexts/NotificationContext';
import { useAuth } from '../../../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../../lib/supabase';
import { Modal, ActivityIndicator } from 'react-native';

interface DashboardHeaderProps {
    officeInfo: any;
    runOCR: (uri: string) => void;
    setIsManualSearchVisible: (visible: boolean) => void;
    onLayout: (e: any) => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    officeInfo,
    runOCR,
    setIsManualSearchVisible,
    onLayout
}) => {
    const { setMode } = useUI();
    const { pendingDeliveryCount, expoPushToken, webPushToken } = useNotifications();
    const { handleLoginSuccess } = useAuth();

    const [savedAccounts, setSavedAccounts] = React.useState<any[]>([]);
    const [isSwitcherVisible, setIsSwitcherVisible] = React.useState(false);
    const [isSwitching, setIsSwitching] = React.useState(false);

    React.useEffect(() => {
        const loadAccounts = async () => {
            try {
                const accountsStr = await AsyncStorage.getItem('saved_admin_accounts');
                if (accountsStr) {
                    setSavedAccounts(JSON.parse(accountsStr));
                }
            } catch (e) {}
        };
        loadAccounts();
    }, [isSwitcherVisible]);

    const handleSwitchBranch = async (account: any) => {
        if (account.company_name === officeInfo?.name) {
            setIsSwitcherVisible(false);
            return;
        }
        setIsSwitching(true);
        try {
            const { data: authData, error } = await supabase.auth.signInWithPassword({
                email: account.email,
                password: account.password
            });
            if (error) throw error;
            
            const { data: profile } = await supabase
                .from('profiles')
                .select('*, companies(*)')
                .eq('id', authData.user!.id)
                .single();
                
            if (profile) {
                await handleLoginSuccess(profile, expoPushToken, webPushToken);
            }
        } catch (e: any) {
            alert('지점 전환 실패: ' + e.message);
        } finally {
            setIsSwitching(false);
            setIsSwitcherVisible(false);
        }
    };

    return (
        <View
            onLayout={onLayout}
            style={{ paddingBottom: 5, paddingTop: 10 }}
        >
            <View>
                <View style={{ marginBottom: 12, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#4F46E5', marginBottom: 2 }}>현재 관리 지점</Text>
                        <Pressable 
                            style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, alignSelf: 'flex-start' }}
                            onPress={() => setIsSwitcherVisible(true)}
                        >
                            <Text style={{ fontSize: 20, fontWeight: '800', color: '#1E293B', marginRight: 6 }}>{officeInfo?.name}</Text>
                            <Ionicons name="chevron-down" size={18} color="#64748B" />
                        </Pressable>
                    </View>
                </View>

                {/* 다중 지점 전환 모달 */}
                <Modal visible={isSwitcherVisible} transparent animationType="fade" onRequestClose={() => setIsSwitcherVisible(false)}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                        <View style={{ backgroundColor: '#fff', width: '100%', maxWidth: 400, borderRadius: 20, padding: 24 }}>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 16 }}>지점 전환 (베타)</Text>
                            
                            {isSwitching ? (
                                <View style={{ padding: 30, alignItems: 'center' }}>
                                    <ActivityIndicator size="large" color="#4F46E5" />
                                    <Text style={{ marginTop: 15, color: '#64748B', fontWeight: '600' }}>지점을 전환하고 있습니다...</Text>
                                </View>
                            ) : (
                                <>
                                    {savedAccounts.length > 0 ? (
                                        savedAccounts.map((acc, idx) => (
                                            <Pressable
                                                key={idx}
                                                style={{
                                                    paddingVertical: 14,
                                                    paddingHorizontal: 16,
                                                    borderWidth: 1,
                                                    borderColor: acc.company_name === officeInfo?.name ? '#4F46E5' : '#E2E8F0',
                                                    borderRadius: 12,
                                                    marginBottom: 10,
                                                    backgroundColor: acc.company_name === officeInfo?.name ? '#EEF2FF' : '#F8FAFC',
                                                    flexDirection: 'row',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center'
                                                }}
                                                onPress={() => handleSwitchBranch(acc)}
                                            >
                                                <Text style={{ fontSize: 16, fontWeight: '700', color: acc.company_name === officeInfo?.name ? '#4F46E5' : '#1E293B' }}>
                                                    {acc.company_name}
                                                </Text>
                                                {acc.company_name === officeInfo?.name && (
                                                    <Ionicons name="checkmark-circle" size={20} color="#4F46E5" />
                                                )}
                                            </Pressable>
                                        ))
                                    ) : (
                                        <Text style={{ color: '#64748B', textAlign: 'center', marginBottom: 20 }}>
                                            로그인 창에서 '기억하기'를 체크하고 로그인한 지점들이 여기에 표시됩니다.
                                        </Text>
                                    )}
                                    <Pressable
                                        style={{ marginTop: 10, paddingVertical: 12, backgroundColor: '#F1F5F9', borderRadius: 12, alignItems: 'center' }}
                                        onPress={() => {
                                            setIsSwitcherVisible(false);
                                            setMode('admin_login');
                                        }}
                                    >
                                        <Text style={{ color: '#475569', fontWeight: '700' }}>+ 다른 지점 새로 로그인</Text>
                                    </Pressable>
                                    <Pressable
                                        style={{ marginTop: 10, paddingVertical: 12, alignItems: 'center' }}
                                        onPress={() => setIsSwitcherVisible(false)}
                                    >
                                        <Text style={{ color: '#94A3B8', fontWeight: '600' }}>닫기</Text>
                                    </Pressable>
                                </>
                            )}
                        </View>
                    </View>
                </Modal>

                <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
                    {pendingDeliveryCount > 0 && (
                        <Pressable
                            style={{
                                backgroundColor: '#FEF2F2',
                                padding: 16,
                                borderRadius: 12,
                                marginBottom: 16,
                                borderWidth: 1,
                                borderColor: '#FCA5A5',
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}
                            onPress={() => {
                                setMode('admin_delivery');
                            }}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                    <Ionicons name="mail-unread" size={20} color="#DC2626" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#991B1B', marginBottom: 2 }}>우편물 전달 신청 도착!</Text>
                                    <Text style={{ fontSize: 13, color: '#B91C1C' }}>{pendingDeliveryCount}건의 처리 대기 중인 신청이 있습니다.</Text>
                                </View>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#DC2626" />
                        </Pressable>
                    )}

                    <View style={[appStyles.premiumInfoCard, { padding: 20 }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={appStyles.premiumInfoLabel}>이번 달 알림 사용량</Text>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#4F46E5' }}>
                                {officeInfo?.current_usage || 0} / {officeInfo?.mail_quota || 100} 건
                            </Text>
                        </View>
                        <View style={{ height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden' }}>
                            <View
                                style={{
                                    width: `${Math.min(100, ((officeInfo?.current_usage || 0) / (officeInfo?.mail_quota || 100)) * 100)}%`,
                                    height: '100%',
                                    backgroundColor: '#4F46E5'
                                }}
                            />
                        </View>
                    </View>
                </View>

                <View style={[appStyles.premiumQuickActionRow, { paddingHorizontal: 20, marginBottom: 10 }]}>
                    <Pressable
                        style={[appStyles.premiumQuickBtn, { backgroundColor: '#1E293B', flex: 2 }]}
                        onPress={async () => {
                            const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
                            if (!result.canceled) {
                                runOCR(result.assets[0].uri);
                                setMode('admin_register_mail');
                            }
                        }}
                    >
                        <Ionicons name="camera" size={32} color="#fff" style={{ marginBottom: 8 }} />
                        <Text style={[appStyles.premiumQuickBtnTitle, { fontSize: 18 }]}>자동인식 알림 발송</Text>
                        <Text style={appStyles.premiumQuickBtnSubtitle}>가장 빠른 AI 매칭</Text>
                    </Pressable>

                    <Pressable
                        style={[appStyles.premiumQuickBtn, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', flex: 1.2 }]}
                        onPress={() => {
                            setIsManualSearchVisible(true);
                            setMode('admin_register_mail');
                        }}
                    >
                        <Ionicons name="people" size={24} color="#64748B" style={{ marginBottom: 8 }} />
                        <Text style={[appStyles.premiumQuickBtnTitle, { color: '#1E293B', fontSize: 14 }]}>수동 등록</Text>
                        <Text style={[appStyles.premiumQuickBtnSubtitle, { color: '#94A3B8' }]}>직접 선택</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
};
