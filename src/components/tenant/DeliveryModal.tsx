import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, Modal, Pressable, TextInput,
    ScrollView, ActivityIndicator, Alert, Dimensions, Platform
} from 'react-native';
// import { WebView } from 'react-native-webview'; // 네이티브 빌전 전 크래시 방지를 위해 일시 주석 처리
const WebView = View as any;
import Ionicons from '@expo/vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '../common/PrimaryButton';
import { mailDeliveryService, MailDeliveryRequest } from '../../services/mailDeliveryService';

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
    const [step, setStep] = useState<'form' | 'postcode' | 'success'>('form');
    const [loading, setLoading] = useState(false);
    const [guidelines, setGuidelines] = useState('');
    const [history, setHistory] = useState<MailDeliveryRequest[]>([]);

    // Form States
    const [name, setName] = useState(initialName || '');
    const [phone, setPhone] = useState(initialPhone || '');
    const [postcode, setPostcode] = useState('');
    const [address, setAddress] = useState('');
    const [addressDetail, setAddressDetail] = useState('');
    const [errorText, setErrorText] = useState<string | null>(null);

    useEffect(() => {
        if (visible) {
            loadGuidelinesAndHistory();
            setName(initialName || '');
            setPhone(initialPhone || '');
        }
    }, [visible, initialName, initialPhone]);

    const loadGuidelinesAndHistory = async () => {
        try {
            const [guide, hist] = await Promise.all([
                mailDeliveryService.getDeliveryGuidelines(companyId),
                mailDeliveryService.getMyRequests(profileId)
            ]);
            setGuidelines(guide || '우편물 전달 신청을 하시면 지정된 주소로 배송해 드립니다.');

            // 중복 주소 제거하여 유니크한 과거 주소 리스트 생성
            const uniqueHistory = (hist || []).reduce((acc: MailDeliveryRequest[], current) => {
                const x = acc.find(item => item.address === current.address && item.address_detail === current.address_detail);
                if (!x) return acc.concat([current]);
                else return acc;
            }, []).slice(0, 3);

            setHistory(uniqueHistory);
        } catch (e: any) {
            console.error('loadGuidelinesAndHistory error:', e);
            if (e.message?.includes('DB 설정')) {
                Alert.alert('시스템 알림', e.message);
            }
        }
    };

    const handleSelectHistory = (item: MailDeliveryRequest) => {
        setPostcode(item.postcode);
        setAddress(item.address);
        setAddressDetail(item.address_detail || '');
    };

    const handleSubmit = async () => {
        if (!name || !phone || !address) {
            Alert.alert('알림', '모든 필수 정보를 입력해 주세요.');
            return;
        }

        try {
            setLoading(true);
            const requestData = {
                company_id: companyId,
                profile_id: profileId,
                recipient_name: name,
                recipient_phone: phone,
                postcode,
                address,
                address_detail: addressDetail
            };
            console.log('Submitting delivery request:', requestData);

            await mailDeliveryService.createRequest(requestData);
            setStep('success');

            // 네이티브 환경의 경우 알림도 띄움
            if (Platform.OS !== 'web') {
                Alert.alert('신청 완료', '우편물 전달 신청이 정상적으로 접수되었습니다.');
            }
        } catch (e: any) {
            console.error('Mail delivery submission error:', e);
            setErrorText(e.message || '신청 중 오류가 발생했습니다.');
            if (Platform.OS === 'web') {
                window.alert(`오류: ${e.message || '신청에 실패했습니다.'}`);
            } else {
                Alert.alert('오류', `신청에 실패했습니다. (${e.message || '잠시 후 다시 시도해 주세요.'})`);
            }
        } finally {
            setLoading(false);
        }
    };

    // Daum Postcode HTML
    const postcodeHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
        </head>
        <body style="margin:0;padding:0;">
            <div id="layer" style="width:100%;height:100vh;"></div>
            <script>
                var element_layer = document.getElementById('layer');
                new daum.Postcode({
                    oncomplete: function(data) {
                        window.ReactNativeWebView.postMessage(JSON.stringify(data));
                    },
                    width : '100%',
                    height : '100%'
                }).embed(element_layer);
            </script>
        </body>
        </html>
    `;

    const onPostcodeMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            setPostcode(data.zonecode);
            setAddress(data.address);
            setStep('form');
        } catch (e) {
            setStep('form');
        }
    };

    if (step === 'postcode') {
        return (
            <Modal visible={visible} animationType="slide" onRequestClose={() => setStep('form')}>
                <SafeAreaView style={styles.postcodeSafe}>
                    <View style={styles.postcodeHeader}>
                        <Pressable onPress={() => setStep('form')} style={styles.backButton}>
                            <Ionicons name="arrow-back" size={24} color="#1E293B" />
                        </Pressable>
                        <Text style={styles.postcodeTitle}>주소 검색</Text>
                    </View>
                    {Platform.OS !== 'web' ? (
                        <WebView
                            source={{ html: postcodeHtml }}
                            onMessage={onPostcodeMessage}
                            style={{ flex: 1 }}
                            onHttpError={(syntheticEvent) => {
                                const { nativeEvent } = syntheticEvent;
                                console.warn('WebView HTTP error: ', nativeEvent);
                            }}
                            renderError={(errorName) => <View style={styles.centered}><Text>주소 검색 서비스를 불러올 수 없습니다. ({errorName})</Text></View>}
                        />
                    ) : (
                        <View style={[styles.centered, { padding: 40 }]}>
                            <Ionicons name="wifi-outline" size={48} color="#CBD5E1" style={{ marginBottom: 20 }} />
                            <Text style={{ textAlign: 'center', fontSize: 16, color: '#475569', lineHeight: 24, marginBottom: 30 }}>
                                웹 환경 또는 에뮬레이터에서는{"\n"}
                                주소 검색이 지원되지 않습니다.{"\n"}
                                직접 입력하시거나 모바일 앱을 이용해 주세요.
                            </Text>
                            <Pressable
                                onPress={() => setStep('form')}
                                style={[styles.cancelBtn, { width: '80%', paddingVertical: 14 }]}
                            >
                                <Text style={styles.cancelBtnText}>돌아가기</Text>
                            </Pressable>
                        </View>
                    )}
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
                            우편물 전달 신청이{"\n"}
                            정상적으로 접수되었습니다.
                        </Text>
                        <PrimaryButton
                            label="확인"
                            onPress={onClose}
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
                        <Text style={styles.title}>우편물 전달 신청</Text>
                        <Pressable onPress={onClose}>
                            <Ionicons name="close" size={24} color="#64748B" />
                        </Pressable>
                    </View>

                    <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
                        <View style={styles.guideBox}>
                            <Text style={styles.guideText}>{guidelines}</Text>
                        </View>

                        {errorText && (
                            <View style={styles.errorBox}>
                                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                                <Text style={styles.errorTextItem}>{errorText}</Text>
                            </View>
                        )}

                        <View style={styles.form}>
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>수령인 이름</Text>
                                <TextInput
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="받으실 분의 성함을 입력하세요"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>수령인 연락처</Text>
                                <TextInput
                                    style={styles.input}
                                    value={phone}
                                    onChangeText={setPhone}
                                    placeholder="010-0000-0000"
                                    keyboardType="phone-pad"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <View style={styles.labelRow}>
                                    <Text style={styles.label}>배송 주소</Text>
                                    <Pressable onPress={() => setStep('postcode')} style={styles.searchBtn}>
                                        <Text style={styles.searchBtnText}>주소 찾기</Text>
                                    </Pressable>
                                </View>
                                <TextInput
                                    style={[styles.input, { backgroundColor: '#F8FAFC' }]}
                                    value={address}
                                    onChangeText={setAddress}
                                    placeholder="주소를 입력하세요 (검색은 빌드 후 가능)"
                                />
                                <TextInput
                                    style={[styles.input, { marginTop: 8 }]}
                                    value={addressDetail}
                                    onChangeText={setAddressDetail}
                                    placeholder="상세 주소를 입력하세요"
                                />
                            </View>

                            {history.length > 0 && (
                                <View style={styles.historySection}>
                                    <Text style={styles.historyTitle}>최근 배송지</Text>
                                    {history.map((item, idx) => (
                                        <Pressable key={idx} style={styles.historyItem} onPress={() => handleSelectHistory(item)}>
                                            <Ionicons name="time-outline" size={16} color="#94A3B8" />
                                            <Text style={styles.historyText} numberOfLines={1}>
                                                {item.address} {item.address_detail}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>
                            )}
                        </View>
                    </ScrollView>

                    <View style={styles.footer}>
                        <Pressable style={styles.cancelBtn} onPress={onClose}>
                            <Text style={styles.cancelBtnText}>취소</Text>
                        </Pressable>
                        <Pressable
                            style={[styles.submitBtn, loading && { opacity: 0.7 }]}
                            onPress={handleSubmit}
                            disabled={loading}
                        >
                            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>신청하기</Text>}
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    content: { backgroundColor: '#fff', borderRadius: 24, maxHeight: '90%', padding: 24 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
    body: { marginBottom: 20 },
    guideBox: { backgroundColor: '#EEF2FF', padding: 16, borderRadius: 12, marginBottom: 24 },
    guideText: { fontSize: 13, color: '#4338CA', lineHeight: 20, fontWeight: '500' },
    form: { gap: 20 },
    inputGroup: { gap: 8 },
    labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    label: { fontSize: 13, fontWeight: '700', color: '#475569', marginLeft: 4 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 15, color: '#1E293B' },
    searchBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    searchBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    historySection: { marginTop: 10, gap: 8 },
    historyTitle: { fontSize: 12, color: '#94A3B8', fontWeight: '700', marginBottom: 4 },
    historyItem: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#F8FAFC', borderRadius: 10, gap: 8 },
    historyText: { flex: 1, fontSize: 13, color: '#64748B' },
    footer: { flexDirection: 'row', gap: 12 },
    cancelBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
    cancelBtnText: { color: '#64748B', fontSize: 16, fontWeight: '700' },
    submitBtn: { flex: 2, paddingVertical: 16, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center' },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    postcodeSafe: { flex: 1, backgroundColor: '#fff' },
    postcodeHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    backButton: { marginRight: 16 },
    postcodeTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
    successIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center'
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF2F2',
        padding: 12,
        borderRadius: 10,
        marginBottom: 20,
        gap: 8,
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    errorTextItem: {
        flex: 1,
        fontSize: 13,
        color: '#EF4444',
        fontWeight: '600'
    }
});
