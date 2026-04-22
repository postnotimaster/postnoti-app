import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, Pressable, TextInput,
    ActivityIndicator, Alert, Modal, ScrollView, Platform, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppContent } from '../../contexts/AppContext';
import { mailDeliveryService, MailDeliveryRequest } from '../../services/mailDeliveryService';
import { notificationService } from '../../services/notificationService';

export const DeliveryScreen = () => {
    const { officeInfo } = useAppContent();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [requests, setRequests] = useState<MailDeliveryRequest[]>([]);
    const [guidelines, setGuidelines] = useState('');
    const [savingGuidelines, setSavingGuidelines] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<MailDeliveryRequest | null>(null);

    const loadData = useCallback(async () => {
        if (!officeInfo?.id) return;
        try {
            setLoading(true);
            const [reqs, guide] = await Promise.all([
                mailDeliveryService.getRequestsByCompany(officeInfo.id),
                mailDeliveryService.getDeliveryGuidelines(officeInfo.id)
            ]);
            setRequests(reqs);
            setGuidelines(guide || '');
        } catch (e) {
            console.error(e);
            Alert.alert('오류', '데이터를 불러오는데 실패했습니다.');
        } finally {
            setLoading(false);
        }
    }, [officeInfo?.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const handleUpdateGuidelines = async () => {
        if (!officeInfo?.id) return;
        try {
            setSavingGuidelines(true);
            await mailDeliveryService.updateDeliveryGuidelines(officeInfo.id, guidelines);
            Alert.alert('성공', '안내 가이드가 수정되었습니다.');
        } catch (e) {
            Alert.alert('오류', '저장에 실패했습니다.');
        } finally {
            setSavingGuidelines(false);
        }
    };

    const handleUpdateStatus = async (request: MailDeliveryRequest, newStatus: any) => {
        try {
            const updated = await mailDeliveryService.updateRequestStatus(request.id, newStatus);
            setRequests(prev => prev.map(r => r.id === request.id ? updated : r));
            setSelectedRequest(null);

            const statusLabels: Record<string, string> = {
                'received': '입금대기',
                'paid': '발송준비',
                'shipped': '발송완료'
            };

            Alert.alert('성공', `요청이 ${statusLabels[newStatus] || newStatus} 상태로 변경되었습니다.`);
        } catch (e) {
            Alert.alert('오류', '상태 변경에 실패했습니다.');
        }
    };

    const renderRequestItem = ({ item }: { item: MailDeliveryRequest }) => {
        const getStatusStyles = (status: string) => {
            switch (status) {
                case 'pending': return { bg: '#FEF3C7', text: '#D97706', label: '접수대기' };
                case 'received': return { bg: '#DBEAFE', text: '#2563EB', label: '입금대기' };
                case 'paid': return { bg: '#E0E7FF', text: '#4338CA', label: '발송준비' };
                case 'shipped': return { bg: '#D1FAE5', text: '#059669', label: '발송완료' };
                default: return { bg: '#F1F5F9', text: '#64748B', label: status };
            }
        };
        const s = getStatusStyles(item.status);

        return (
            <Pressable style={styles.requestCard} onPress={() => setSelectedRequest(item)}>
                <View style={styles.cardHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: s.bg }]}>
                        <Text style={[styles.statusText, { color: s.text }]}>{s.label}</Text>
                    </View>
                    <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.recipientName}>{item.recipient_name} <Text style={styles.phoneText}>({item.recipient_phone})</Text></Text>
                <Text style={styles.addressText} numberOfLines={1}>{item.address} {item.address_detail}</Text>
                <View style={styles.cardFooter}>
                    <Text style={styles.profileInfo}>신청자: {item.profiles?.name || '알 수 없음'}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </View>
            </Pressable>
        );
    };

    if (loading && !refreshing) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#4F46E5" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>우편물 전달 관리</Text>
            </View>

            <FlatList
                data={requests}
                keyExtractor={item => item.id}
                renderItem={renderRequestItem}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                ListHeaderComponent={
                    <View style={styles.guidelineSection}>
                        <View style={styles.sectionTitleRow}>
                            <Text style={styles.sectionTitle}>전달 안내 가이드 (입주사 노출)</Text>
                            <Pressable
                                style={[styles.saveButton, savingGuidelines && { opacity: 0.7 }]}
                                onPress={handleUpdateGuidelines}
                                disabled={savingGuidelines}
                            >
                                {savingGuidelines ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveButtonText}>저장</Text>}
                            </Pressable>
                        </View>
                        <TextInput
                            style={styles.guidelineInput}
                            multiline
                            value={guidelines}
                            onChangeText={setGuidelines}
                            placeholder="입주사에게 보여줄 우편물 전달 안내 사항을 입력하세요."
                            placeholderTextColor="#94A3B8"
                        />
                        <View style={styles.divider} />
                        <Text style={styles.sectionTitle}>최신 신청 내역</Text>
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="paper-plane-outline" size={48} color="#CBD5E1" />
                        <Text style={styles.emptyText}>전달 신청 내역이 없습니다.</Text>
                    </View>
                }
            />

            <Modal visible={!!selectedRequest} transparent animationType="slide" onRequestClose={() => setSelectedRequest(null)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>신청 상세 내역</Text>
                            <Pressable onPress={() => setSelectedRequest(null)}>
                                <Ionicons name="close" size={24} color="#64748B" />
                            </Pressable>
                        </View>

                        {selectedRequest && (
                            <ScrollView style={styles.modalBody}>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>수령인명</Text>
                                    <Text style={styles.detailValue}>{selectedRequest.recipient_name}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>연락처</Text>
                                    <Text style={styles.detailValue}>{selectedRequest.recipient_phone}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>우편번호</Text>
                                    <Text style={styles.detailValue}>{selectedRequest.postcode || '-'}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>주소</Text>
                                    <Text style={styles.detailValue}>{selectedRequest.address}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>상세주소</Text>
                                    <Text style={styles.detailValue}>{selectedRequest.address_detail || '-'}</Text>
                                </View>
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>신청일시</Text>
                                    <Text style={styles.detailValue}>{new Date(selectedRequest.created_at).toLocaleString()}</Text>
                                </View>

                                <View style={styles.actionContainer}>
                                    {selectedRequest.status === 'pending' && (
                                        <Pressable
                                            style={[styles.actionButton, { backgroundColor: '#4F46E5' }]}
                                            onPress={() => handleUpdateStatus(selectedRequest, 'received')}
                                        >
                                            <Text style={styles.actionButtonText}>접수 완료 처리 (입금대기)</Text>
                                        </Pressable>
                                    )}
                                    {selectedRequest.status === 'received' && (
                                        <Pressable
                                            style={[styles.actionButton, { backgroundColor: '#4338CA' }]}
                                            onPress={() => handleUpdateStatus(selectedRequest, 'paid')}
                                        >
                                            <Text style={styles.actionButtonText}>입금 확인 처리 (발송준비중)</Text>
                                        </Pressable>
                                    )}
                                    {selectedRequest.status === 'paid' && (
                                        <Pressable
                                            style={[styles.actionButton, { backgroundColor: '#059669' }]}
                                            onPress={() => handleUpdateStatus(selectedRequest, 'shipped')}
                                        >
                                            <Text style={styles.actionButtonText}>발송 완료 처리</Text>
                                        </Pressable>
                                    )}
                                    {selectedRequest.status === 'shipped' && (
                                        <View style={styles.completeBadge}>
                                            <Ionicons name="checkmark-circle" size={20} color="#059669" />
                                            <Text style={styles.completeText}>모든 처리가 완료되었습니다.</Text>
                                        </View>
                                    )}
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
    listContent: { padding: 16 },
    guidelineSection: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9' },
    sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: '#475569' },
    saveButton: { backgroundColor: '#4F46E5', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8 },
    saveButtonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    guidelineInput: { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, minHeight: 120, fontSize: 14, color: '#1E293B', textAlignVertical: 'top' },
    divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 20 },
    requestCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 11, fontWeight: '800' },
    dateText: { fontSize: 12, color: '#94A3B8' },
    recipientName: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 4 },
    phoneText: { color: '#64748B', fontWeight: '400' },
    addressText: { fontSize: 14, color: '#475569', marginBottom: 12 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 10 },
    profileInfo: { fontSize: 12, color: '#94A3B8' },
    emptyContainer: { alignItems: 'center', marginTop: 40 },
    emptyText: { marginTop: 12, color: '#94A3B8', fontSize: 14 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%', padding: 24 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
    modalBody: { flex: 1 },
    detailRow: { marginBottom: 16 },
    detailLabel: { fontSize: 13, color: '#64748B', marginBottom: 4 },
    detailValue: { fontSize: 16, color: '#1E293B', fontWeight: '600' },
    actionContainer: { marginTop: 24, paddingBottom: 40 },
    actionButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 12 },
    actionButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    completeBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: '#ECFDF5', borderRadius: 12 },
    completeText: { marginLeft: 8, color: '#059669', fontWeight: '700' }
});
