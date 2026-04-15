import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Image, Modal, SafeAreaView, ActivityIndicator, SectionList, Alert, BackHandler, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useAppContent } from '../contexts/AppContext';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { TenantMailHistory } from '../components/admin/TenantMailHistory';
import { mailService } from '../services/mailService';
import { tenantsService } from '../services/tenantsService';

export const AdminDashboardScreen = ({ route }: any) => {
    const navigation = useNavigation<any>();
    const {
        officeInfo,
        profiles,
        setProfiles,
        masterSenders,
        setMasterSenders,
        isHistoryVisible,
        setIsHistoryVisible,
        selectedProfileForHistory,
        setSelectedProfileForHistory,
        runOCR,
        isManualSearchVisible,
        setIsManualSearchVisible,
    } = useAppContent();

    // 자체 대시보드 상태 (AppContext에서 분리됨)
    const [mailLogs, setMailLogs] = useState<any[]>([]);
    const [logSearchQuery, setLogSearchQuery] = useState('');
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [mailStats, setMailStats] = useState<Record<string, { total: number; read: number; lastSentAt: string | null }>>({});

    // 화면 포커스 시 첫 페이지 로드
    useFocusEffect(
        useCallback(() => {
            if (officeInfo?.id) {
                loadFirstPage();
            }
        }, [officeInfo?.id])
    );

    const loadFirstPage = async () => {
        try {
            setInitialLoading(true);
            const result = await mailService.getMailsByCompanyPaginated(officeInfo!.id, 0);
            setMailLogs(result.data);
            setHasMore(result.hasMore);
            setPage(0);
            // 통계도 함께 로드
            try {
                const stats = await tenantsService.getMailStatsByCompany(officeInfo!.id);
                setMailStats(stats);
            } catch (e) { }
        } catch (e) {
            console.error('Failed to load mail logs:', e);
        } finally {
            setInitialLoading(false);
        }
    };

    const loadNextPage = async () => {
        if (!hasMore || loadingMore || !officeInfo?.id) return;
        try {
            setLoadingMore(true);
            const nextPage = page + 1;
            const result = await mailService.getMailsByCompanyPaginated(officeInfo.id, nextPage);
            setMailLogs(prev => [...prev, ...result.data]);
            setHasMore(result.hasMore);
            setPage(nextPage);
        } catch (e) {
            console.error('Failed to load next page:', e);
        } finally {
            setLoadingMore(false);
        }
    };

    // 뒤로가기 종료 처리 (포커스되었을 때만 작동)
    useFocusEffect(
        React.useCallback(() => {
            const backAction = () => {
                if (isHistoryVisible || isManualSearchVisible) {
                    return false; // 모달이 떠있을 때는 내부에서 처리하거나 시스템 기본 동작(닫기) 유도
                }
                Alert.alert("앱 종료", "정말 앱을 종료하시겠습니까?", [
                    { text: "취소", style: "cancel" },
                    { text: "종료", onPress: () => BackHandler.exitApp() }
                ]);
                return true;
            };

            const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
            return () => backHandler.remove();
        }, [isHistoryVisible, isManualSearchVisible])
    );

    if (!officeInfo) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={{ marginTop: 10 }}>오피스 정보를 불러오는 중...</Text>
            </View>
        );
    }

    return (
        <SafeAreaView style={appStyles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={appStyles.flexContainer}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <AppHeader
                    title="Postnoti Admin"
                    onMenu={() => navigation.navigate('AdminMenu')}
                />
                <SectionList
                    style={appStyles.container}
                    contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
                    keyboardShouldPersistTaps="handled"
                    ListHeaderComponent={
                        <View style={{ paddingBottom: 10 }}>
                            <View style={{ marginBottom: 20 }}>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#4F46E5', marginBottom: 4 }}>HELLO, ADMIN</Text>
                                <Text style={{ fontSize: 28, fontWeight: '800', color: '#1E293B' }}>{officeInfo?.name}</Text>
                            </View>

                            <View style={[appStyles.premiumInfoCard, { marginBottom: 20, padding: 20 }]}>
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

                            <View style={appStyles.premiumQuickActionRow}>
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

                            <View style={[appStyles.premiumInfoCard, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 }]}>
                                <Text style={[appStyles.premiumInfoLabel, { marginBottom: 16 }]}>최근 발송 내역</Text>
                                <View style={[appStyles.premiumSearchBox, { marginBottom: 5 }]}>
                                    <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ position: 'absolute', left: 14, top: 14, zIndex: 1 }} />
                                    <TextInput
                                        style={[appStyles.premiumSearchInput, { paddingLeft: 42 }]}
                                        placeholder="받는분, 호실 등으로 검색..."
                                        value={logSearchQuery}
                                        onChangeText={setLogSearchQuery}
                                    />
                                    {initialLoading && (
                                        <ActivityIndicator size="small" color="#4F46E5" style={{ position: 'absolute', right: 14, top: 14 }} />
                                    )}
                                </View>
                            </View>
                        </View>
                    }
                    sections={(() => {
                        const filtered = mailLogs.filter(log => {
                            const query = logSearchQuery.toLowerCase();
                            const name = log.tenants?.name?.toLowerCase() || '';
                            const room = log.tenants?.room_number?.toLowerCase() || '';
                            const company = log.tenants?.company_name?.toLowerCase() || '';
                            const sender = log.ocr_content?.toLowerCase() || '';
                            return name.includes(query) || room.includes(query) || company.includes(query) || sender.includes(query);
                        });

                        const groups: { [key: string]: any[] } = {};
                        filtered.forEach(log => {
                            const date = new Date(log.created_at);
                            const dateStr = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
                            const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
                            const yesterdayDate = new Date();
                            yesterdayDate.setDate(yesterdayDate.getDate() - 1);
                            const yesterday = yesterdayDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

                            let header = dateStr;
                            const shortDate = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
                            if (dateStr === today) header = `오늘 (${shortDate})`;
                            if (dateStr === yesterday) header = `어제 (${shortDate})`;

                            if (!groups[header]) groups[header] = [];
                            groups[header].push(log);
                        });

                        return Object.keys(groups).map(key => ({
                            title: key,
                            data: groups[key]
                        }));
                    })()}
                    keyExtractor={(item) => item.id}
                    renderSectionHeader={({ section: { title } }) => (
                        <View style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 20, paddingVertical: 8, marginTop: 10 }}>
                            <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B' }}>{title}</Text>
                        </View>
                    )}
                    renderItem={({ item: log }) => (
                        <View style={{ paddingHorizontal: 20, backgroundColor: '#fff' }}>
                            <Pressable
                                style={[appStyles.logItem, { marginBottom: 0, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', borderRadius: 0, paddingVertical: 14 }]}
                                onPress={() => {
                                    if (log.tenants) {
                                        setSelectedProfileForHistory(log.tenants);
                                        setIsHistoryVisible(true);
                                    }
                                }}
                            >
                                <Image
                                    source={log.image_url ? { uri: log.image_url } : { uri: 'https://via.placeholder.com/50' }}
                                    style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#E2E8F0', marginRight: 12 }}
                                    resizeMode="cover"
                                />
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2, gap: 6, flexWrap: 'wrap' }}>
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#6366F1', backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' }}>
                                            {log.tenants?.room_number || '-'}
                                        </Text>
                                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#1E293B' }}>
                                            {log.tenants?.company_name || '(미등록)'}
                                        </Text>
                                        <Text style={{ fontSize: 13, color: '#64748B' }}>{log.tenants?.name}</Text>
                                    </View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                                        <Text style={{ fontSize: 13, color: '#475569', flex: 1 }} numberOfLines={1}>
                                            {log.ocr_content || ''}
                                        </Text>
                                        {log.tenants?.is_active === false && (
                                            <View style={{ backgroundColor: '#FEF2F2', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 }}>
                                                <Text style={{ fontSize: 9, color: '#991B1B', fontWeight: '700' }}>퇴거</Text>
                                            </View>
                                        )}
                                        {log.tenants?.is_premium && (
                                            <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, borderWidth: 1, borderColor: '#C7D2FE' }}>
                                                <Text style={{ fontSize: 9, color: '#4338CA', fontWeight: '700' }}>P</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>
                                        {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                    </Text>
                                    <View style={{ backgroundColor: log.read_at ? '#DCFCE7' : '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                        <Text style={{ fontSize: 10, color: log.read_at ? '#15803D' : '#64748B', fontWeight: '600' }}>
                                            {log.read_at ? '읽음' : '미개봉'}
                                        </Text>
                                    </View>
                                </View>
                            </Pressable>
                        </View>
                    )}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                            {loadingMore ? (
                                <ActivityIndicator size="small" color="#4F46E5" />
                            ) : hasMore ? (
                                <Pressable
                                    onPress={loadNextPage}
                                    style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}
                                >
                                    <Text style={{ color: '#475569', fontWeight: '700', fontSize: 13 }}>이전 내역 더보기 ⌄</Text>
                                </Pressable>
                            ) : mailLogs.length > 0 ? (
                                <Text style={{ color: '#94A3B8', fontSize: 12 }}>모든 내역을 불러왔습니다</Text>
                            ) : null}
                        </View>
                    }
                    ListEmptyComponent={
                        <Text style={[appStyles.emptyText, { textAlign: 'center', marginTop: 30 }]}>검색 결과가 없습니다.</Text>
                    }
                    stickySectionHeadersEnabled={true}
                />

                <Modal
                    visible={isHistoryVisible}
                    animationType="fade"
                    transparent
                    onRequestClose={() => setIsHistoryVisible(false)}
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }}>
                        <View style={{ backgroundColor: '#fff', margin: 20, borderRadius: 20, flex: 1, maxHeight: '80%', overflow: 'hidden' }}>
                            <View style={{ padding: 15, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ marginBottom: 6 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <Text style={{ fontSize: 13, fontWeight: '800', color: '#6366F1', backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' }}>
                                                    {selectedProfileForHistory?.room_number || '-'}
                                                </Text>
                                                <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B' }}>
                                                    {selectedProfileForHistory?.company_name || '(미등록)'}
                                                </Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                <Text style={{ fontSize: 15, color: '#475569', fontWeight: '600' }}>{selectedProfileForHistory?.name}</Text>
                                                {selectedProfileForHistory?.phone && (
                                                    <Pressable
                                                        onPress={() => Linking.openURL(`tel:${selectedProfileForHistory.phone}`)}
                                                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#BAE6FD' }}
                                                    >
                                                        <Ionicons name="call" size={12} color="#0369A1" style={{ marginRight: 4 }} />
                                                        <Text style={{ fontSize: 12, color: '#0369A1', fontWeight: '800' }}>{selectedProfileForHistory.phone}</Text>
                                                    </Pressable>
                                                )}
                                            </View>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                            <View style={{ backgroundColor: selectedProfileForHistory?.is_active ? '#F0FDF4' : '#FEF2F2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: selectedProfileForHistory?.is_active ? '#166534' : '#991B1B' }}>
                                                    {selectedProfileForHistory?.is_active ? '입주중' : '퇴거'}
                                                </Text>
                                            </View>
                                            {selectedProfileForHistory?.is_premium && (
                                                <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#C7D2FE' }}>
                                                    <Text style={{ fontSize: 10, fontWeight: '700', color: '#4338CA' }}>Premium</Text>
                                                </View>
                                            )}
                                            {selectedProfileForHistory?.id && mailStats[selectedProfileForHistory.id] && (() => {
                                                const s = mailStats[selectedProfileForHistory.id!];
                                                const rate = s.total > 0 ? Math.round((s.read / s.total) * 100) : 0;
                                                return (
                                                    <Text style={{ fontSize: 11, fontWeight: '800', color: s.total > 0 && rate < 50 ? '#DC2626' : s.total > 0 && rate >= 80 ? '#059669' : '#D97706' }}>
                                                        개봉 {s.read}/{s.total}
                                                    </Text>
                                                );
                                            })()}
                                        </View>
                                    </View>
                                    <Pressable onPress={() => setIsHistoryVisible(false)} style={{ padding: 15, marginRight: -10 }}>
                                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#64748B' }}>✕</Text>
                                    </Pressable>
                                </View>
                            </View>
                            {selectedProfileForHistory && (
                                <TenantMailHistory
                                    tenant={selectedProfileForHistory}
                                    onClose={() => setIsHistoryVisible(false)}
                                />
                            )}
                        </View>
                    </View>
                </Modal>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};
