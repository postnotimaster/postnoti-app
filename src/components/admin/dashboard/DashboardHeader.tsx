import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { appStyles } from '../../../styles/appStyles';

interface DashboardHeaderProps {
    officeInfo: any;
    navigation: any;
    runOCR: (uri: string) => void;
    setIsManualSearchVisible: (visible: boolean) => void;
    onLayout: (e: any) => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
    officeInfo,
    navigation,
    runOCR,
    setIsManualSearchVisible,
    onLayout
}) => {
    return (
        <View
            onLayout={onLayout}
            style={{ paddingBottom: 5, paddingTop: 10 }}
        >
            <View>
                <View style={{ marginBottom: 12, paddingHorizontal: 20 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#4F46E5', marginBottom: 2 }}>HELLO, ADMIN</Text>
                    <Text style={{ fontSize: 24, fontWeight: '800', color: '#1E293B' }}>{officeInfo?.name}</Text>
                </View>

                <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
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
                                navigation.navigate('AdminRegisterMail');
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
                            navigation.navigate('AdminRegisterMail');
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
