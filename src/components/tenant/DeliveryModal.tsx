import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Modal, Pressable, TextInput,
    ScrollView, ActivityIndicator, Alert, Platform, FlatList, Switch
} from 'react-native';
// import { WebView } from 'react-native-webview';
const WebView = View as any;
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../common/PrimaryButton';
import { mailDeliveryService, MailDeliveryRequest, MailDeliveryStatus } from '../../services/mailDeliveryService';
import { profilesService } from '../../services/profilesService';
import { supabase } from '../../lib/supabase';

type Props = {
    visible: boolean;
    onClose: () => void;
    companyId: string;
    profileId: string;
    initialName?: string;
    initialPhone?: string;
};

export const DeliveryModal = ({
    visible,
    onClose,
    companyId,
    profileId,
    initialName,
    initialPhone
}: Props) => {
    const [activeTab, setActiveTab] = useState<'request' | 'list'>('request');
    const [step, setStep] = useState<'form' | 'postcode' | 'success'>('form');
    const [loading, setLoading] = useState(false);
    const [paymentInfo, setPaymentInfo] = useState<{ amount: string, bank: string, account: string, holder: string } | null>(null);
    const [requests, setRequests] = useState<MailDeliveryRequest[]>([]);
    const [recentAddresses, setRecentAddresses] = useState<MailDeliveryRequest[]>([]);
    const [savedAddress, setSavedAddress] = useState<{ address: string, address_detail: string, postcode: string } | null>(null);

    // Form States
    const [name, setName] = useState(initialName || '');
    const [phone, setPhone] = useState(initialPhone || '');
    const [postcode, setPostcode] = useState('');
    const [address, setAddress] = useState('');
    const [addressDetail, setAddressDetail] = useState('');
    const [saveAsDefault, setSaveAsDefault] = useState(false);
    const [errorText, setErrorText] = useState<string | null>(null);
    const [missingFields, setMissingFields] = useState<string[]>([]);

    const loadData = useCallback(async () => {
        try {
            const [guide, hist, profile] = await Promise.all([
                mailDeliveryService.getDeliveryGuidelines(companyId),
                mailDeliveryService.getMyRequests(profileId),
                profilesService.getProfileById(profileId).catch(() => null)
            ]);

            const guideStr = guide || '';
            try {
                if (guideStr.startsWith('{')) {
                    setPaymentInfo(JSON.parse(guideStr));
                } else {
                    setPaymentInfo(null);
                }
            } catch (e) {
                setPaymentInfo(null);
            }
            setRequests(hist || []);

            if (profile?.address) {
                setSavedAddress({
                    address: profile.address,
                    address_detail: profile.address_detail || '',
                    postcode: profile.postcode || ''
                });
            } else {
                setSavedAddress(null);
            }

            // 최근 주소 (중복 제거)
            const unique = (hist || []).reduce((acc: MailDeliveryRequest[], cur) => {
                const exists = acc.find(a => a.address === cur.address);
                if (!exists) acc.push(cur);
                return acc;
            }, []).slice(0, 3);
            setRecentAddresses(unique);
        } catch (e) {
            console.error('loadData error:', e);
        }
    }, [companyId, profileId]);

    useEffect(() => {
        if (visible) {
            loadData();
            setActiveTab('request');
            setStep('form');
            setErrorText(null);
            setMissingFields([]);
            setSaveAsDefault(false);
        }
    }, [visible, loadData]);

    // 실시간 구독
    useEffect(() => {
        if (!visible || !profileId) return;

        const channel = supabase
            .channel(`mail_delivery_${profileId}`)
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'mail_delivery_requests' },
                (payload) => {
                    const newReq = payload.new as MailDeliveryRequest;
                    if (newReq.profile_id === profileId || newReq.tenant_id === profileId) {
                        setRequests(prev => prev.map(r => r.id === newReq.id ? { ...r, ...newReq } : r));
                    }
                }
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [visible, profileId]);

    // 웹 환경 메시지 수신 (Daum 주소 검색)
    useEffect(() => {
        if (Platform.OS === 'web' && step === 'postcode') {
            const handleWebMessage = (e: MessageEvent) => {
                if (e.data && typeof e.data === 'string') {
                    try {
                        const data = JSON.parse(e.data);
                        if (data.zonecode || data.address) handlePostcodeSelected(data);
                    } catch (err) { }
                }
            };
            window.addEventListener('message', handleWebMessage);
            return () => window.removeEventListener('message', handleWebMessage);
        }
    }, [step]);

    const handleSelectHistory = (item: any) => {
        setPostcode(item.postcode || '');
        setAddress(item.address || '');
        setAddressDetail(item.address_detail || '');
        setMissingFields(prev => prev.filter(f => f !== 'address'));
    };

    const handlePostcodeSelected = (data: any) => {
        setPostcode(data.zonecode || '');
        setAddress(data.address || '');
        setStep('form');
        setMissingFields(prev => prev.filter(f => f !== 'address'));
    };

    const handleSubmit = async () => {
        const missing = [];
        if (!name) missing.push('name');
        if (!phone) missing.push('phone');
        if (!address) missing.push('address');

        if (missing.length > 0) {
            setMissingFields(missing);
            setErrorText('붉은색으로 표시된 필수 항목을 모두 입력해 주세요.');
            return;
        }

        const requestData = {
            company_id: companyId,
            profile_id: profileId,
            tenant_id: profileId,
            recipient_name: name,
            recipient_phone: phone,
            postcode,
            address,
            address_detail: addressDetail
        };

        try {
            setLoading(true);
            setErrorText(null);
            setMissingFields([]);

            // 1. 프로필 주소 업데이트 (체크된 경우)
            if (saveAsDefault) {
                await profilesService.updateProfile(profileId, {
                    address,
                    address_detail: addressDetail,
                    postcode
                }).catch(e => console.warn('Failed to save default address:', e));
            }

            // 2. 요청 생성
            await mailDeliveryService.createRequest(requestData as any);
            setStep('success');
            loadData();
        } catch (e: any) {
            console.error('Submit error:', e);
            if (e.code === '23503' && e.message?.includes('profile_id')) {
                try {
                    const fallbackData = { ...requestData, profile_id: null };
                    await mailDeliveryService.createRequest(fallbackData as any);
                    setStep('success');
                    loadData();
                    return;
                } catch (retryError) { }
            }
            setErrorText(e.message || '신청에 실패했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusInfo = (status: MailDeliveryStatus) => {
        switch (status) {
            case 'pending': return { label: '접수대기', color: '#D97706', bg: '#FEF3C7', icon: 'time-outline' };
            case 'received': return { label: '입금대기', color: '#2563EB', bg: '#DBEAFE', icon: 'wallet-outline' };
            case 'paid': return { label: '발송준비', color: '#4338CA', bg: '#E0E7FF', icon: 'cube-outline' };
            case 'shipped': return { label: '발송완료', color: '#059669', bg: '#D1FAE5', icon: 'checkmark-circle-outline' };
            default: return { label: status, color: '#64748B', bg: '#F1F5F9', icon: 'help-circle-outline' };
        }
    };

    // --- Steps Rendering ---

    if (step === 'postcode') {
        const postcodeUrl = 'https://postnoti-app-two.vercel.app/postcode.html';
        return (
            <Modal visible={visible} animationType="slide" onRequestClose={() => setStep('form')}>
                <SafeAreaView style={styles.postcodeSafe}>
                    <View style={styles.postcodeHeader}>
                        <Pressable onPress={() => setStep('form')} style={styles.backButton}>
                            <Ionicons name="chevron-back" size={28} color="#1E293B" />
                        </Pressable>
                        <Text style={styles.postcodeTitle}>주소 검색</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        {Platform.OS === 'web' ? (
                            <iframe src={postcodeUrl} style={{ border: 'none', width: '100%', height: '100%' }} title="주소 검색" />
                        ) : (
                            <WebView
                                source={{ uri: postcodeUrl }}
                                onMessage={(event: any) => {
                                    try {
                                        const data = JSON.parse(event.nativeEvent.data);
                                        handlePostcodeSelected(data);
                                    } catch (e) { }
                                }}
                                style={{ flex: 1 }}
                            />
                        )}
                    </View>
                </SafeAreaView>
            </Modal>
        );
    }

    if (step === 'success') {
        return (
            <Modal visible={visible} transparent animationType="fade">
                <View style={styles.overlay}>
                    <View style={[styles.content, { alignItems: 'center', paddingVertical: 40 }]}>
                        <View style={styles.successIconCircle}>
                            <Ionicons name="checkmark" size={40} color="#fff" />
                        </View>
                        <Text style={[styles.title, { marginTop: 20, marginBottom: 10 }]}>신청 완료!</Text>
                        <Text style={{ textAlign: 'center', color: '#64748B', lineHeight: 22, marginBottom: 30 }}>
                            우편물 전달 신청이{"\n"}정상적으로 접수되었습니다.
                        </Text>
                        <PrimaryButton
                            label="내역 확인하기"
                            onPress={() => { setStep('form'); setActiveTab('list'); }}
                            style={{ width: '100%', borderRadius: 12 }}
                        />
                    </View>
                </View>
            </Modal>
        );
    }

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <View style={styles.tabs}>
                            <Pressable onPress={() => setActiveTab('request')} style={[styles.tab, activeTab === 'request' && styles.activeTab]}>
                                <Text style={[styles.tabText, activeTab === 'request' && styles.activeTabText]}>신청하기</Text>
                            </Pressable>
                            <Pressable onPress={() => setActiveTab('list')} style={[styles.tab, activeTab === 'list' && styles.activeTab]}>
                                <Text style={[styles.tabText, activeTab === 'list' && styles.activeTabText]}>신청현황</Text>
                            </Pressable>
                        </View>
                        <Pressable onPress={onClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#64748B" />
                        </Pressable>
                    </View>

                    {activeTab === 'request' ? (
                        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                            <View style={styles.guideBox}>
                                <Ionicons name="information-circle" size={18} color="#4338CA" />
                                <Text style={styles.guideText}>{guidelines}</Text>
                            </View>

                            {errorText && (
                                <View style={styles.errorBanner}>
                                    <Ionicons name="alert-circle" size={16} color="#EF4444" />
                                    <Text style={styles.errorBannerText}>{errorText}</Text>
                                </View>
                            )}

                            <View style={styles.form}>
                                <View style={styles.inputGroup}>
                                    <Text style={[styles.label, missingFields.includes('name') && { color: '#EF4444' }]}>수령인 정보 *</Text>
                                    <TextInput style={[styles.input, missingFields.includes('name') && styles.errorInput]} value={name} onChangeText={(t) => { setName(t); setMissingFields(prev => prev.filter(f => f !== 'name')); }} placeholder="성함" />
                                    <TextInput style={[styles.input, { marginTop: 8 }, missingFields.includes('phone') && styles.errorInput]} value={phone} onChangeText={(t) => { setPhone(t); setMissingFields(prev => prev.filter(f => f !== 'phone')); }} placeholder="연락처" keyboardType="phone-pad" />
                                </View>

                                <View style={styles.inputGroup}>
                                    <View style={styles.labelRow}>
                                        <Text style={[styles.label, missingFields.includes('address') && { color: '#EF4444' }]}>배송 주소 *</Text>
                                        <Pressable onPress={() => setStep('postcode')} style={styles.searchBtn}>
                                            <Text style={styles.searchBtnText}>주소 찾기</Text>
                                        </Pressable>
                                    </View>

                                    <View style={styles.quickInputRow}>
                                        {savedAddress && (
                                            <Pressable style={styles.premiumQuickBtn} onPress={() => handleSelectHistory(savedAddress)}>
                                                <Ionicons name="bookmark" size={12} color="#fff" />
                                                <Text style={styles.premiumQuickBtnText}>등록 주소 사용</Text>
                                            </Pressable>
                                        )}
                                        {recentAddresses.length > 0 && (
                                            <Pressable style={styles.useLastAddressBtn} onPress={() => handleSelectHistory(recentAddresses[0])}>
                                                <Ionicons name="time" size={12} color="#4F46E5" />
                                                <Text style={styles.useLastAddressText}>최근 배송지</Text>
                                            </Pressable>
                                        )}
                                    </View>

                                    <TextInput
                                        style={[styles.input, (Platform.OS !== 'web') && { backgroundColor: '#F8FAFC' }, missingFields.includes('address') && styles.errorInput]}
                                        value={address}
                                        onChangeText={(t) => { setAddress(t); setMissingFields(prev => prev.filter(f => f !== 'address')); }}
                                        placeholder="주소 (직접 입력 또는 검색)"
                                        editable={Platform.OS === 'web' || !address}
                                    />
                                    <TextInput style={[styles.input, { marginTop: 8 }]} value={addressDetail} onChangeText={setAddressDetail} placeholder="상세 주소" />

                                    <View style={styles.saveDefaultRow}>
                                        <Switch value={saveAsDefault} onValueChange={setSaveAsDefault} trackColor={{ false: "#E2E8F0", true: "#C7D2FE" }} thumbColor={saveAsDefault ? "#4F46E5" : "#F4F3F4"} />
                                        <Text style={styles.saveDefaultText}>입력한 주소를 내 기본 주소로 저장하기</Text>
                                    </View>
                                </View>
                            </View>
                            <View style={{ height: 30 }} />
                            <PrimaryButton label="전달 신청하기" onPress={handleSubmit} loading={loading} disabled={loading} />
                            <View style={{ height: 20 }} />
                        </ScrollView>
                    ) : (
                        <FlatList
                            data={requests}
                            keyExtractor={item => item.id}
                            style={styles.body}
                            contentContainerStyle={{ paddingBottom: 20 }}
                            renderItem={({ item }) => {
                                const status = getStatusInfo(item.status);
                                return (
                                    <View style={styles.requestCard}>
                                        <View style={styles.cardHeader}>
                                            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                                                <Ionicons name={status.icon as any} size={14} color={status.color} />
                                                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                                            </View>
                                            <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                                        </View>
                                        <Text style={styles.cardRecipient}>{item.recipient_name} <Text style={{ fontWeight: '400', color: '#94A3B8' }}>({item.recipient_phone})</Text></Text>
                                        <Text style={styles.cardAddress} numberOfLines={1}>{item.address} {item.address_detail}</Text>
                                        {item.status === 'received' && (
                                            <View style={styles.infoNote}>
                                                {paymentInfo ? (
                                                    <View>
                                                        <Text style={styles.infoNoteText}>금액: {paymentInfo.amount}</Text>
                                                        <Text style={styles.infoNoteText}>입금계좌: {paymentInfo.bank} {paymentInfo.account}</Text>
                                                        <Text style={styles.infoNoteText}>예금주: {paymentInfo.holder}</Text>
                                                    </View>
                                                ) : (
                                                    <Text style={styles.infoNoteText}>결제 정보가 아직 설정되지 않았습니다.</Text>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                );
                            }}
                            ListEmptyComponent={
                                <View style={styles.emptyBox}>
                                    <Ionicons name="document-text-outline" size={48} color="#CBD5E1" />
                                    <Text style={styles.emptyText}>신청 내역이 없습니다.</Text>
                                </View>
                            }
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
    content: { backgroundColor: '#fff', borderRadius: 28, maxHeight: '85%', padding: 20 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    tabs: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, flex: 1, marginRight: 12 },
    tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
    activeTab: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
    tabText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
    activeTabText: { color: '#1E293B' },
    closeBtn: { padding: 4 },
    body: { flexGrow: 0 },
    guideBox: { backgroundColor: '#EEF2FF', padding: 14, borderRadius: 14, marginBottom: 16, flexDirection: 'row', gap: 10, alignItems: 'center' },
    guideText: { fontSize: 13, color: '#4338CA', lineHeight: 18, flex: 1 },
    errorBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', padding: 10, borderRadius: 10, marginBottom: 16, gap: 8 },
    errorBannerText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
    form: { gap: 16 },
    inputGroup: { gap: 6 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { fontSize: 13, fontWeight: '700', color: '#475569', marginLeft: 4 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 15, color: '#1E293B' },
    errorInput: { borderColor: '#EF4444', backgroundColor: '#FFF5F5' },
    searchBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    searchBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    quickInputRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    premiumQuickBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#4F46E5', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, gap: 6 },
    premiumQuickBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    useLastAddressBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, gap: 6 },
    useLastAddressText: { color: '#4F46E5', fontSize: 12, fontWeight: '700' },
    saveDefaultRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 10 },
    saveDefaultText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
    requestCard: { padding: 16, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#F1F5F9', marginBottom: 12, elevation: 1 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
    statusText: { fontSize: 11, fontWeight: '800' },
    cardDate: { fontSize: 11, color: '#94A3B8' },
    cardRecipient: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
    cardAddress: { fontSize: 13, color: '#64748B' },
    infoNote: { marginTop: 10, padding: 10, backgroundColor: '#F0F9FF', borderRadius: 8 },
    infoNoteText: { fontSize: 11, color: '#0369A1', lineHeight: 15 },
    emptyBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
    emptyText: { color: '#94A3B8', fontSize: 14 },
    postcodeSafe: { flex: 1, backgroundColor: '#fff' },
    postcodeHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    backButton: { marginRight: 12 },
    postcodeTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
    successIconCircle: { width: 70, height: 70, borderRadius: 35, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
    title: { fontSize: 22, fontWeight: '900', color: '#1E293B' }
});
