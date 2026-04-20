import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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

import { DashboardHeader } from '../components/admin/dashboard/DashboardHeader';
import { DashboardSearchBar } from '../components/admin/dashboard/DashboardSearchBar';
import { MailHistoryCard } from '../components/admin/dashboard/MailHistoryCard';
import { TenantInfoSummary } from '../components/admin/dashboard/TenantInfoSummary';


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
                        <DashboardHeader
                            officeInfo={officeInfo}
                            navigation={navigation}
                            runOCR={runOCR}
                            setIsManualSearchVisible={setIsManualSearchVisible}
                            onLayout={(e) => { headerHeightRef.current = e.nativeEvent.layout.height; }}
                        />
                    }
                    sections={useMemo(() => {
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
                    }, [mailLogs, logSearchQuery])}
                    keyExtractor={(item, index) => item?.id || `extra-${index}`}
                    renderItem={({ item, section }) => {
                        if (section.type === 'search') return null; // 검색 섹션의 아이템은 렌더링하지 않음 (헤더만 사용)

                        const log = item;
                        return (
                            <MailHistoryCard
                                log={item}
                                onPress={(tenant) => {
                                    setSelectedProfileForHistory(tenant);
                                    setIsHistoryVisible(true);
                                }}
                            />
                        );
                    }}
                    renderSectionHeader={({ section }) => {
                        if (section.type === 'search') {
                            return (
                                <DashboardSearchBar
                                    isSearchFocused={isSearchFocused}
                                    logSearchQuery={logSearchQuery}
                                    setLogSearchQuery={setLogSearchQuery}
                                    initialLoading={initialLoading}
                                    onSearchFocus={() => {
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
                                    onSearchBlur={() => setIsSearchFocused(false)}
                                    dateFilter={dateFilter}
                                    setDateFilter={setDateFilter}
                                />
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
                            <TenantInfoSummary
                                tenant={selectedProfileForHistory}
                                mailStats={mailStats}
                                onClose={() => setIsHistoryVisible(false)}
                            />
                            {selectedProfileForHistory && (
                                <TenantMailHistory
                                    tenant={selectedProfileForHistory}
                                    officeInfo={officeInfo}
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
