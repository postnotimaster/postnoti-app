import React from 'react';
import { View, Text, ScrollView, Pressable, TextInput, Image, Modal, SafeAreaView, ActivityIndicator, SectionList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useAppContent } from '../contexts/AppContext';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { TenantManagement } from '../components/admin/TenantManagement';
import { SenderManagement } from '../components/admin/SenderManagement';
import { TenantMailHistory } from '../components/admin/TenantMailHistory';
import { profilesService } from '../services/profilesService';
import { masterSendersService } from '../services/masterSendersService';

export const AdminDashboardScreen = () => {
    const navigation = useNavigation<any>();
    const {
        officeInfo,
        mailLogs,
        setMailLogs,
        profiles,
        setProfiles,
        masterSenders,
        setMasterSenders,
        logSearchQuery,
        setLogSearchQuery,
        logPageSize,
        setLogPageSize,
        isAdminMenuVisible,
        setIsAdminMenuVisible,
        isTenantMgmtVisible,
        setIsTenantMgmtVisible,
        isSenderMgmtVisible,
        setIsSenderMgmtVisible,
        isHistoryVisible,
        setIsHistoryVisible,
        selectedProfileForHistory,
        setSelectedProfileForHistory,
        runOCR,
        setIsManualSearchVisible,
        isRefreshing,
    } = useAppContent();

    const handleBack = () => {
        // [1:1 구조 개편] 뒤로가기 시 지점 선택이 아닌 랜딩으로 이동 (혹은 뒤로가기 제한)
        navigation.replace('Landing');
    };

    if (!officeInfo) {
        // 데이터가 없으면 로그인 혹은 초기 로딩 문제
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#4F46E5" />
                <Text style={{ marginTop: 10 }}>지점 정보를 불러오는 중...</Text>
            </View>
        );
    }

    return (
        <View style={appStyles.flexContainer}>
            <AppHeader
                title={`${officeInfo?.name} 관리`}
                onBack={handleBack}
                onMenu={() => setIsAdminMenuVisible(true)}
            />
            <SectionList
                style={appStyles.container}
                contentContainerStyle={{ paddingBottom: 100, paddingTop: 10 }}
                ListHeaderComponent={
                    <>
                        <View style={appStyles.premiumQuickActionRow}>
                            <Pressable
                                style={[appStyles.premiumQuickBtn, { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' }]}
                                onPress={() => {
                                    setIsManualSearchVisible(true);
                                    navigation.navigate('AdminRegisterMail');
                                }}
                            >
                                <Ionicons name="people-outline" size={28} color="#1E293B" style={{ marginBottom: 8 }} />
                                <Text style={[appStyles.premiumQuickBtnTitle, { color: '#1E293B' }]}>수동선택 알림</Text>
                                <Text style={[appStyles.premiumQuickBtnSubtitle, { color: '#64748B' }]}>직접 선택 후 발송</Text>
                            </Pressable>

                            <Pressable
                                style={[appStyles.premiumQuickBtn, { backgroundColor: '#1E293B' }]}
                                onPress={async () => {
                                    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
                                    if (!result.canceled) {
                                        runOCR(result.assets[0].uri);
                                        navigation.navigate('AdminRegisterMail');
                                    }
                                }}
                            >
                                <Ionicons name="camera-outline" size={28} color="#fff" style={{ marginBottom: 8 }} />
                                <Text style={appStyles.premiumQuickBtnTitle}>자동인식 알림</Text>
                                <Text style={appStyles.premiumQuickBtnSubtitle}>AI가 입주사 찾기</Text>
                            </Pressable>
                        </View>

                        <View style={[appStyles.premiumInfoCard, { marginTop: 10, paddingBottom: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 }]}>
                            <Text style={[appStyles.premiumInfoLabel, { marginBottom: 16 }]}>최근 발송 내역</Text>
                            <View style={[appStyles.premiumSearchBox, { marginBottom: 5 }]}>
                                <Ionicons name="search-outline" size={18} color="#94A3B8" style={{ position: 'absolute', left: 14, top: 14, zIndex: 1 }} />
                                <TextInput
                                    style={[appStyles.premiumSearchInput, { paddingLeft: 42 }]}
                                    placeholder="받는분, 호실, 발신처 검색..."
                                    value={logSearchQuery}
                                    onChangeText={setLogSearchQuery}
                                />
                                {isRefreshing && (
                                    <ActivityIndicator size="small" color="#4F46E5" style={{ position: 'absolute', right: 14, top: 14 }} />
                                )}
                            </View>
                        </View>
                    </>
                }
                sections={(() => {
                    const filtered = mailLogs.filter(log => {
                        const query = logSearchQuery.toLowerCase();
                        const name = log.profiles?.name?.toLowerCase() || '';
                        const room = log.profiles?.room_number?.toLowerCase() || '';
                        const sender = log.ocr_content?.toLowerCase() || '';
                        return name.includes(query) || room.includes(query) || sender.includes(query);
                    }).slice(0, logPageSize);

                    const groups: { [key: string]: any[] } = {};
                    filtered.forEach(log => {
                        const date = new Date(log.created_at);
                        const dateStr = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

                        // 오늘/어제 체크
                        const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
                        const yesterdayDate = new Date();
                        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
                        const yesterday = yesterdayDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

                        let header = dateStr;
                        if (dateStr === today) header = '오늘';
                        if (dateStr === yesterday) header = '어제';

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
                                if (log.profiles) {
                                    setSelectedProfileForHistory(log.profiles);
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
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                                    <Text style={[appStyles.logName, { fontSize: 15 }]}>{log.profiles?.name}</Text>
                                    <Text style={{ fontSize: 12, color: '#94A3B8', marginLeft: 6 }}>{log.profiles?.room_number}</Text>
                                </View>
                                <Text style={[appStyles.logSender, { fontSize: 13, color: '#475569' }]} numberOfLines={1}>
                                    {log.ocr_content ? `${log.ocr_content}` : '발신처 미상'}
                                </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>
                                    {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                </Text>
                                <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                    <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }}>{log.mail_type}</Text>
                                </View>
                            </View>
                        </Pressable>
                    </View>
                )}
                onEndReached={() => {
                    if (logPageSize < mailLogs.length) {
                        setLogPageSize(logPageSize + 20);
                    }
                }}
                onEndReachedThreshold={0.5}
                ListFooterComponent={() => (
                    <View style={{ height: 20 }} />
                )}
                ListEmptyComponent={
                    <Text style={[appStyles.emptyText, { textAlign: 'center', marginTop: 30 }]}>검색 결과가 없습니다.</Text>
                }
                stickySectionHeadersEnabled={true}
            />

            {/* 입주사 관리 모달 */}
            <Modal
                visible={isTenantMgmtVisible}
                animationType="slide"
                onRequestClose={() => setIsTenantMgmtVisible(false)}
            >
                <SafeAreaView style={{ flex: 1 }}>
                    <AppHeader title={`${officeInfo?.name} 입주사 관리`} onBack={() => setIsTenantMgmtVisible(false)} />
                    {officeInfo && (
                        <TenantManagement
                            companyId={officeInfo.id}
                            onComplete={async () => {
                                setIsTenantMgmtVisible(false);
                                const p = await profilesService.getProfilesByCompany(officeInfo.id);
                                setProfiles(p);
                            }}
                            onCancel={() => setIsTenantMgmtVisible(false)}
                        />
                    )}
                </SafeAreaView>
            </Modal>

            {/* 발신처 관리 모달 */}
            <Modal
                visible={isSenderMgmtVisible}
                animationType="slide"
                onRequestClose={() => setIsSenderMgmtVisible(false)}
            >
                <SafeAreaView style={{ flex: 1 }}>
                    <AppHeader title="발신처 키워드 관리" onBack={async () => {
                        setIsSenderMgmtVisible(false);
                        const senders = await masterSendersService.getAllSenders();
                        setMasterSenders(senders.map(s => s.name));
                    }} />
                    <SenderManagement onClose={() => setIsSenderMgmtVisible(false)} />
                </SafeAreaView>
            </Modal>

            {/* 상세 이력 모달 */}
            <Modal
                visible={isHistoryVisible}
                animationType="fade"
                transparent
                onRequestClose={() => setIsHistoryVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }}>
                    <View style={{ backgroundColor: '#fff', margin: 20, borderRadius: 20, flex: 1, maxHeight: '80%', overflow: 'hidden' }}>
                        <View style={{ padding: 15, borderBottomWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 18, fontWeight: '700' }}>
                                {selectedProfileForHistory?.name}님의 우편함
                            </Text>
                            <Pressable onPress={() => setIsHistoryVisible(false)} style={{ padding: 5 }}>
                                <Text style={{ fontSize: 16 }}>✕</Text>
                            </Pressable>
                        </View>
                        {selectedProfileForHistory && (
                            <TenantMailHistory
                                profile={selectedProfileForHistory}
                                onClose={() => setIsHistoryVisible(false)}
                            />
                        )}
                    </View>
                </View>
            </Modal>

            {/* 햄버거 메뉴 모달 */}
            <Modal
                visible={isAdminMenuVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsAdminMenuVisible(false)}
            >
                <Pressable
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' }}
                    onPress={() => setIsAdminMenuVisible(false)}
                >
                    <View style={appStyles.premiumBottomSheet}>
                        <View style={appStyles.bottomSheetHandle} />
                        <View style={appStyles.bottomSheetHeader}>
                            <Text style={appStyles.bottomSheetTitle}>지점 설정 및 관리</Text>
                            <Text style={appStyles.bottomSheetSubtitle}>필요한 관리 기능을 선택해 주세요</Text>
                        </View>
                        <View style={{ gap: 12 }}>
                            <Pressable
                                onPress={() => { setIsAdminMenuVisible(false); setIsTenantMgmtVisible(true); }}
                                style={appStyles.premiumMenuBtn}
                            >
                                <Ionicons name="business-outline" size={22} color="#1E293B" style={{ marginRight: 16 }} />
                                <View style={appStyles.menuBtnTextGroup}>
                                    <Text style={appStyles.menuBtnLabel}>입주사 데이터 관리</Text>
                                    <Text style={appStyles.menuBtnDesc}>입주사 등록, 수정 및 상태 관리</Text>
                                </View>
                                <Ionicons name="chevron-forward-outline" size={20} color="#CBD5E1" />
                            </Pressable>

                            <Pressable
                                onPress={() => { setIsAdminMenuVisible(false); setIsSenderMgmtVisible(true); }}
                                style={appStyles.premiumMenuBtn}
                            >
                                <Ionicons name="key-outline" size={22} color="#1E293B" style={{ marginRight: 16 }} />
                                <View style={appStyles.menuBtnTextGroup}>
                                    <Text style={appStyles.menuBtnLabel}>발신처 키워드 설정</Text>
                                    <Text style={appStyles.menuBtnDesc}>자동 인식을 위한 필터링 키워드 관리</Text>
                                </View>
                                <Ionicons name="chevron-forward-outline" size={20} color="#CBD5E1" />
                            </Pressable>

                            {/* 지점 공유 링크 */}
                            <View style={[appStyles.premiumMenuBtn, { backgroundColor: '#F1F5F9', borderStyle: 'dashed' }]}>
                                <Ionicons name="link-outline" size={22} color="#4F46E5" style={{ marginRight: 16 }} />
                                <View style={appStyles.menuBtnTextGroup}>
                                    <Text style={[appStyles.menuBtnLabel, { color: '#4F46E5' }]}>입주자 전용 링크</Text>
                                    <Text style={appStyles.menuBtnDesc} numberOfLines={1}>
                                        https://postnoti-app.vercel.app/branch/{officeInfo?.slug}
                                    </Text>
                                </View>
                                <Pressable
                                    onPress={async () => {
                                        const url = `https://postnoti-app.vercel.app/branch/${officeInfo?.slug}`;
                                        await Clipboard.setStringAsync(url);
                                        // Alert needs to be imported from react-native if not already available in scope, 
                                        // but AdminDashboardScreen has it imported.
                                        // Using global Alert or imported Alert
                                        const { Alert } = require('react-native');
                                        Alert.alert('복사 완료', `링크가 복사되었습니다.\n${url}`);
                                    }}
                                    style={{ backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}
                                >
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>복사</Text>
                                </Pressable>
                            </View>

                            <View style={appStyles.menuSeparator} />

                            <Pressable
                                onPress={() => {
                                    setIsAdminMenuVisible(false);
                                    const { supabase } = require('../lib/supabase');
                                    supabase.auth.signOut();
                                    navigation.replace('Landing');
                                }}
                                style={appStyles.premiumExitBtn}
                            >
                                <Ionicons name="log-out-outline" size={20} color="#E11D48" style={{ marginRight: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={appStyles.exitBtnLabel}>로그아웃</Text>
                                    <Text style={appStyles.exitBtnDesc}>현재 계정에서 안전하게 나가기</Text>
                                </View>
                            </Pressable>
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
};
