import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList,
    ActivityIndicator, TextInput, Pressable, Modal,
    ScrollView, Switch, Alert, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppContent } from '../../contexts/AppContext';
import { noticeService, Announcement } from '../../services/noticeService';
import { notificationService } from '../../services/notificationService';
import { appStyles } from '../../styles/appStyles';
import { AppHeader } from '../../components/common/AppHeader';

export const AdminNoticeScreen = () => {
    const { officeInfo, profiles } = useAppContent();
    const [notices, setNotices] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingNotice, setEditingNotice] = useState<Partial<Announcement> | null>(null);

    // Form fields
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [isPriority, setIsPriority] = useState(false);
    const [targetTenants, setTargetTenants] = useState<string[]>([]); // Empty means all

    useEffect(() => {
        loadNotices();
    }, [officeInfo]);

    const loadNotices = async () => {
        if (!officeInfo) return;
        setLoading(true);
        try {
            const data = await noticeService.getAllAnnouncements(officeInfo.id);
            setNotices(data);
        } catch (err) {
            console.error('Load notices error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingNotice(null);
        setTitle('');
        setContent('');
        setIsPriority(false);
        setTargetTenants([]);
        setModalVisible(true);
    };

    const handleEdit = (notice: Announcement) => {
        setEditingNotice(notice);
        setTitle(notice.title);
        setContent(notice.content);
        setIsPriority(notice.priority > 0);
        setTargetTenants(notice.target_tenant_ids || []);
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!title.trim() || !content.trim()) {
            Alert.alert('알림', '제목과 내용을 모두 입력해주세요.');
            return;
        }

        try {
            const noticeData: Partial<Announcement> = {
                company_id: officeInfo?.id!,
                title: title.trim(),
                content: content.trim(),
                priority: isPriority ? 1 : 0,
                target_tenant_ids: targetTenants.length > 0 ? targetTenants : null,
                is_active: true
            };

            if (editingNotice?.id) {
                await noticeService.updateAnnouncement(editingNotice.id, noticeData);
            } else {
                await noticeService.createAnnouncement(noticeData);
            }

            // 알림 발송 (비동기, 블로킹 방지)
            notificationService.sendNoticePush(
                officeInfo!,
                title.trim(),
                content.trim(),
                targetTenants.length > 0 ? targetTenants : null
            );

            setModalVisible(false);
            loadNotices();
            Alert.alert('완료', '공지사항이 저장되었습니다.');
        } catch (err) {
            Alert.alert('오류', '저장 중 문제가 발생했습니다.');
        }
    };

    const handleDelete = async (id: string) => {
        Alert.alert('삭제 확인', '정말 이 공지사항을 삭제하시겠습니까?', [
            { text: '취소', style: 'cancel' },
            {
                text: '삭제',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await noticeService.deleteAnnouncement(id);
                        loadNotices();
                    } catch (err) {
                        Alert.alert('오류', '삭제 중 문제가 발생했습니다.');
                    }
                }
            }
        ]);
    };

    const toggleTargetTenant = (id: string) => {
        setTargetTenants(prev =>
            prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
        );
    };

    const renderNoticeItem = ({ item }: { item: Announcement }) => (
        <View style={styles.noticeCard}>
            <View style={styles.noticeHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {item.priority > 0 && (
                        <View style={styles.priorityBadge}>
                            <Text style={styles.priorityText}>중요</Text>
                        </View>
                    )}
                    <Text style={styles.noticeDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <Pressable onPress={() => handleEdit(item)}>
                        <Ionicons name="create-outline" size={20} color="#6366F1" />
                    </Pressable>
                    <Pressable onPress={() => handleDelete(item.id)}>
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </Pressable>
                </View>
            </View>
            <Text style={styles.noticeTitle}>{item.title}</Text>
            <Text style={styles.noticeContent} numberOfLines={2}>{item.content}</Text>
            {item.target_tenant_ids && (
                <View style={styles.targetBadge}>
                    <Text style={styles.targetText}>타겟팅({item.target_tenant_ids.length})</Text>
                </View>
            )}
        </View>
    );

    return (
        <SafeAreaView style={appStyles.safeArea} edges={['top', 'left', 'right']}>
            <AppHeader title="공지사항 관리" />
            <View style={styles.container}>
                <View style={styles.toolbar}>
                    <Text style={styles.countText}>전체 {notices.length}개</Text>
                    <Pressable style={styles.addButton} onPress={handleAdd}>
                        <Ionicons name="add" size={20} color="#fff" />
                        <Text style={styles.addButtonText}>새 공지 작성</Text>
                    </Pressable>
                </View>

                {loading ? (
                    <ActivityIndicator style={{ marginTop: 50 }} color="#4F46E5" />
                ) : (
                    <FlatList
                        data={notices}
                        keyExtractor={(item) => item.id}
                        renderItem={renderNoticeItem}
                        contentContainerStyle={{ padding: 20 }}
                        ListEmptyComponent={<Text style={styles.emptyText}>등록된 공지사항이 없습니다.</Text>}
                    />
                )}
            </View>

            {/* 작성/수정 모달 */}
            <Modal visible={modalVisible} animationType="slide">
                <SafeAreaView style={{ flex: 1 }}>
                    <View style={styles.modalHeader}>
                        <Pressable onPress={() => setModalVisible(false)}>
                            <Text style={styles.cancelText}>취소</Text>
                        </Pressable>
                        <Text style={styles.modalTitle}>{editingNotice ? '공지 수정' : '새 공지 작성'}</Text>
                        <Pressable onPress={handleSave}>
                            <Text style={styles.saveText}>저장</Text>
                        </Pressable>
                    </View>

                    <ScrollView style={styles.modalContent}>
                        <View style={styles.formGroup}>
                            <Text style={styles.label}>제목</Text>
                            <TextInput
                                style={styles.input}
                                value={title}
                                onChangeText={setTitle}
                                placeholder="공지 제목을 입력하세요"
                            />
                        </View>

                        <View style={styles.formGroup}>
                            <Text style={styles.label}>내용</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                value={content}
                                onChangeText={setContent}
                                placeholder="공지 내용을 입력하세요"
                                multiline
                                textAlignVertical="top"
                            />
                        </View>

                        <View style={styles.switchGroup}>
                            <View>
                                <Text style={styles.label}>중요 공지 설정</Text>
                                <Text style={styles.helpText}>리스트 상단에 고정 표시됩니다.</Text>
                            </View>
                            <Switch value={isPriority} onValueChange={setIsPriority} trackColor={{ true: '#4F46E5' }} />
                        </View>

                        <View style={[styles.formGroup, { marginTop: 20 }]}>
                            <Text style={styles.label}>노출 대상 설정</Text>
                            <Text style={styles.helpText}>아무것도 선택하지 않으면 전체 공지로 나갑니다.</Text>
                            <View style={styles.tenantPicker}>
                                {profiles.map(p => (
                                    <Pressable
                                        key={p.id}
                                        style={[
                                            styles.tenantChip,
                                            targetTenants.includes(p.id) && styles.tenantChipActive
                                        ]}
                                        onPress={() => toggleTargetTenant(p.id)}
                                    >
                                        <Text style={[
                                            styles.tenantChipText,
                                            targetTenants.includes(p.id) && styles.tenantChipTextActive
                                        ]}>
                                            {p.room_number ? `[${p.room_number}] ` : ''}{p.company_name || p.name}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                        <View style={{ height: 100 }} />
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff' },
    countText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
    addButton: { backgroundColor: '#4F46E5', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, gap: 4 },
    addButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    noticeCard: { backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    noticeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    noticeDate: { fontSize: 12, color: '#94A3B8' },
    priorityBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    priorityText: { fontSize: 10, color: '#EF4444', fontWeight: '800' },
    noticeTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
    noticeContent: { fontSize: 13, color: '#64748B', lineHeight: 18 },
    targetBadge: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#F0F9FF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    targetText: { fontSize: 10, color: '#0EA5E9', fontWeight: '700' },
    emptyText: { textAlign: 'center', marginTop: 50, color: '#94A3B8' },

    // Modal
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    modalTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
    cancelText: { color: '#64748B', fontWeight: '600' },
    saveText: { color: '#4F46E5', fontWeight: '800' },
    modalContent: { flex: 1, padding: 20 },
    formGroup: { marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
    helpText: { fontSize: 12, color: '#94A3B8', marginBottom: 10 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, fontSize: 15 },
    textArea: { height: 150 },
    switchGroup: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12 },
    tenantPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tenantChip: { backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    tenantChipActive: { backgroundColor: '#4F46E5' },
    tenantChipText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
    tenantChipTextActive: { color: '#fff' },
});
