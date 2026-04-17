import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Image, Modal, ActivityIndicator, SectionList, Alert, BackHandler, KeyboardAvoidingView, Platform, Linking, LayoutAnimation, UIManager, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useAppContent } from '../contexts/AppContext';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { TenantMailHistory } from '../components/admin/TenantMailHistory';
import { mailService } from '../services/mailService';
import { tenantsService } from '../services/tenantsService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
    const [dateFilter, setDateFilter] = useState<number | undefined>(1); // 기본 1개월 필터 적용
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [mailStats, setMailStats] = useState<Record<string, { total: number; read: number; lastSentAt: string | null }>>({});
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    const sectionListRef = useRef<any>(null);
    const headerHeightRef = useRef<number>(0);
    const isSearchPinnedRef = useRef<boolean>(false);

    // 화면 포커스 시 첫 페이지 로드
    useFocusEffect(
        useCallback(() => {
            if (officeInfo?.id) {
                loadFirstPage();
            }
        }, [officeInfo?.id, dateFilter])
    );

    // 키보드 닫힘 감지 (물리 백버튼으로 닫힐 때 완벽 복구 보장)
    useEffect(() => {
        const keyboardDidHideListener = Keyboard.addListener('keyboardDidHide', () => {
            if (isSearchPinnedRef.current) {
                isSearchPinnedRef.current = false;
                setIsSearchFocused(false);
                sectionListRef.current?.getScrollResponder()?.scrollTo({
                    y: 0,
                    animated: true
                });
            }
        });

        return () => {
            keyboardDidHideListener.remove();
        };
    }, []);

    const loadFirstPage = async () => {
        try {
            setInitialLoading(true);
            const result = await mailService.getMailsByCompanyPaginated(officeInfo!.id, 0, dateFilter);
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
            const result = await mailService.getMailsByCompanyPaginated(officeInfo.id, nextPage, dateFilter);
            setMailLogs((prev: any[]) => [...prev, ...result.data]);
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
        useCallback(() => {
            const backAction = () => {
                if (isSearchFocused || isSearchPinnedRef.current) {
                    Keyboard.dismiss();
                    setIsSearchFocused(false);
                    isSearchPinnedRef.current = false;
                    sectionListRef.current?.getScrollResponder()?.scrollTo({
                        y: 0,
                        animated: true
                    });
                    return true;
                }
                if (isHistoryVisible || isManualSearchVisible) {
                    return false; // 모달이나 서치는 내부 뒤로가기 동작 유도 (이미 AppContext 등에서 처리되거나 기본동작)
                }
                Alert.alert("앱 종료", "정말 앱을 종료하시겠습니까?", [
                    { text: "취소", style: "cancel" },
                    { text: "종료", onPress: () => BackHandler.exitApp() }
                ]);
                return true;
            };

            const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
            return () => backHandler.remove();
        }, [isSearchFocused, isHistoryVisible, isManualSearchVisible])
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
        <SafeAreaView style={appStyles.safeArea} edges={['top', 'left', 'right']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={appStyles.flexContainer}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <SectionList
                    ref={sectionListRef}
                    style={appStyles.flexContainer}
                    contentContainerStyle={{ paddingBottom: isSearchFocused ? 600 : 100, paddingTop: 0 }}
                    stickySectionHeadersEnabled={true}
                    keyboardShouldPersistTaps="handled"
                    onScroll={(e) => {
                        const y = e.nativeEvent.contentOffset.y;
                        // 헤더가 항상 있으므로, y가 상단 근처(30)로 올라가면 포커스 해제
                        if (y < 30) {
                            if (isSearchFocused) {
                                setIsSearchFocused(false);
                                Keyboard.dismiss();
                            }
                            isSearchPinnedRef.current = false;
                        }
                    }}
                    scrollEventThrottle={16}
                    ListHeaderComponent={
                        <View
                            onLayout={(e) => { headerHeightRef.current = e.nativeEvent.layout.height; }}
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

                        const logsSections = Object.keys(groups).map(key => ({
                            title: key,
                            type: 'log',
                            data: groups[key]
                        }));

                        return [
                            { title: 'SEARCH_CONTROLS', type: 'search', data: [{ id: 'search-placeholder' }] },
                            ...logsSections
                        ];
                    })()}
                    keyExtractor={(item, index) => item?.id || `extra-${index}`}
                    renderItem={({ item, section }) => {
                        if (section.type === 'search') return null; // 검색 섹션의 아이템은 렌더링하지 않음 (헤더만 사용)

                        const log = item;
                        return (
                            <View style={{ paddingHorizontal: 20, backgroundColor: '#fff' }}>
                                <Pressable
                                    style={{
                                        flexDirection: 'row',
                                        padding: 12,
                                        backgroundColor: '#fff',
                                        borderRadius: 16,
                                        borderWidth: 1,
                                        borderColor: '#F1F5F9',
                                        alignItems: 'center',
                                        marginBottom: 10,
                                        elevation: 2,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 1 },
                                        shadowOpacity: 0.05,
                                        shadowRadius: 2,
                                    }}
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
                        );
                    }}
                    renderSectionHeader={({ section }) => {
                        if (section.type === 'search') {
                            return (
                                <View style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                                    <View style={{
                                        position: 'relative',
                                        height: 48,
                                        justifyContent: 'center',
                                        backgroundColor: '#F8FAFC',
                                        borderRadius: 14,
                                        borderWidth: 1,
                                        borderColor: isSearchFocused ? '#4F46E5' : '#E2E8F0',
                                    }}>
                                        <Ionicons name="search-outline" size={20} color={isSearchFocused ? '#4F46E5' : '#94A3B8'} style={{ position: 'absolute', left: 16, zIndex: 1 }} />
                                        <TextInput
                                            style={{
                                                height: 48,
                                                paddingLeft: 48,
                                                paddingRight: 40,
                                                fontSize: 15,
                                                color: '#1E293B',
                                                fontWeight: '600',
                                                paddingVertical: 0
                                            }}
                                            placeholder="이름, 회사명, 호실 검색"
                                            placeholderTextColor="#94A3B8"
                                            value={logSearchQuery}
                                            onChangeText={setLogSearchQuery}
                                            onFocus={() => {
                                                isSearchPinnedRef.current = true;
                                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                                setIsSearchFocused(true);
                                                setTimeout(() => {
                                                    if (headerHeightRef.current > 0) {
                                                        sectionListRef.current?.getScrollResponder()?.scrollTo({
                                                            y: headerHeightRef.current,
                                                            animated: true
                                                        });
                                                    }
                                                }, 50);
                                            }}
                                            onBlur={() => setIsSearchFocused(false)}
                                        />
                                        {(initialLoading || logSearchQuery.length > 0) && (
                                            <Pressable
                                                onPress={() => setLogSearchQuery('')}
                                                style={{ position: 'absolute', right: 12, padding: 4 }}
                                            >
                                                {initialLoading ? (
                                                    <ActivityIndicator size="small" color="#4F46E5" />
                                                ) : (
                                                    <Ionicons name="close-circle" size={20} color="#CBD5E1" />
                                                )}
                                            </Pressable>
                                        )}
                                    </View>

                                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                                        {[
                                            { l: '전체', v: undefined },
                                            { l: '1개월', v: 1 },
                                            { l: '3개월', v: 3 },
                                            { l: '6개월', v: 6 }
                                        ].map(f => (
                                            <Pressable
                                                key={f.l}
                                                onPress={() => setDateFilter(f.v)}
                                                style={{
                                                    paddingHorizontal: 12,
                                                    paddingVertical: 6,
                                                    borderRadius: 10,
                                                    backgroundColor: dateFilter === f.v ? '#1E293B' : '#F1F5F9',
                                                    borderWidth: 1,
                                                    borderColor: dateFilter === f.v ? '#1E293B' : '#E2E8F0'
                                                }}
                                            >
                                                <Text style={{
                                                    fontSize: 12,
                                                    fontWeight: '700',
                                                    color: dateFilter === f.v ? '#fff' : '#64748B'
                                                }}>{f.l}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>
                            );
                        }
                        return (
                            <View style={{ backgroundColor: '#fff', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginBottom: 4, paddingHorizontal: 20 }}>
                                <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E293B' }}>{section.title}</Text>
                            </View>
                        );
                    }}
                    ListEmptyComponent={
                        <Text style={[appStyles.emptyText, { textAlign: 'center', marginTop: 30 }]}>검색 결과가 없습니다.</Text>
                    }
                    onEndReached={loadNextPage}
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
                                        <View style={{ gap: 6, alignItems: 'flex-start', marginTop: 4 }}>
                                            {/* 입주 상태 배지 */}
                                            <View style={{ backgroundColor: selectedProfileForHistory?.status === '입주' || (!selectedProfileForHistory?.status && selectedProfileForHistory?.is_active) ? '#059669' : '#64748B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
                                                <Text style={{ fontSize: 11, fontWeight: '900', color: '#fff' }}>
                                                    {selectedProfileForHistory?.status || (selectedProfileForHistory?.is_active ? '입주중' : '퇴거')}
                                                </Text>
                                            </View>

                                            {/* 보관 정책 및 개봉 현황 (한 줄에 배치) */}
                                            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                                <Pressable
                                                    onPress={() => {
                                                        const days = selectedProfileForHistory?.retention_days ?? 14;
                                                        const msg = days === 0
                                                            ? "이 입주사의 우편물 사진은 삭제되지 않고 영구 보관됩니다."
                                                            : `이 입주사의 우편물 사진은 등록 후 ${days}일(${days / 7}주)이 지나면 자동 삭제되며, OCR 텍스트 기록만 보존됩니다.`;
                                                        Alert.alert("사진 보관 정책 안내", msg);
                                                    }}
                                                    style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 30, borderWidth: 1, borderColor: '#C7D2FE' }}
                                                >
                                                    <Text style={{ fontSize: 10, color: '#4338CA', fontWeight: '800' }}>
                                                        {selectedProfileForHistory?.retention_days === 0 ? '영구보관' : `${(selectedProfileForHistory?.retention_days ?? 14) / 7}주보관`}
                                                    </Text>
                                                </Pressable>

                                                {selectedProfileForHistory?.id && mailStats[selectedProfileForHistory.id] && (() => {
                                                    const s = mailStats[selectedProfileForHistory.id!];
                                                    return (
                                                        <View style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 30, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#475569' }}>
                                                                개봉 {s.read}/{s.total}
                                                            </Text>
                                                        </View>
                                                    );
                                                })()}
                                            </View>
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
        </SafeAreaView >
    );
};
