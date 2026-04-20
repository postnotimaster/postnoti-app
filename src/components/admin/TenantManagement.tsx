import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TextInput,
    Alert,
    Pressable,
    ActivityIndicator,
    Switch,
    BackHandler,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { tenantsService, Tenant } from '../../services/tenantsService';
import { PrimaryButton } from '../common/PrimaryButton';

type MailStats = Record<string, { total: number; read: number; lastSentAt: string | null }>;

interface TenantManagementProps {
    companyId: string;
    onComplete: () => void;
    onCancel: () => void;
}

export const TenantManagement = forwardRef(({ companyId, onComplete, onCancel }: TenantManagementProps, ref) => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [mailStats, setMailStats] = useState<MailStats>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'recent' | 'name' | 'room'>('recent');
    const [isEditing, setIsEditing] = useState(false);

    useImperativeHandle(ref, () => ({
        handleBack: () => {
            if (isEditing) {
                setIsEditing(false);
                return true;
            }
            return false;
        },
        resetToListView: () => {
            setIsEditing(false);
        }
    }));
    const [editingTenant, setEditingTenant] = useState<Partial<Tenant>>({
        company_id: companyId,
        company_name: '',
        name: '',
        room_number: '',
        phone: '',
        is_active: true,
        is_premium: false,
        retention_days: 14 // 기본값 2주
    });

    useEffect(() => {
        loadTenants();
    }, []);

    // BackHandler 로직은 Parent 컴포넌트에서 useImperativeHandle(ref)를 통해
    // handleBack 함수를 직접 호출하도록 이관됨 (리스너 중복/충돌 방지)

    const loadTenants = async () => {
        try {
            setLoading(true);
            const [data, stats] = await Promise.all([
                tenantsService.getTenantsByCompany(companyId),
                tenantsService.getMailStatsByCompany(companyId),
            ]);
            setTenants(data);
            setMailStats(stats);
        } catch (error) {
            console.error(error);
            Alert.alert('\uc624\ub958', '\uc785\uc8fc\uc790 \ubaa9\ub85d\uc744 \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!editingTenant.name || !editingTenant.phone) {
            Alert.alert('\uc54c\ub9bc', '\uc774\ub984\uacfc \uc804\ud654\ubc88\ud638\ub294 \ud544\uc218\uc785\ub2c8\ub2e4.');
            return;
        }
        try {
            setLoading(true);

            // 상태값에 따른 is_active 강제 동기화 (하위 호환성 유지)
            const finalTenant = { ...editingTenant };
            if (!finalTenant.status) {
                finalTenant.status = finalTenant.is_active ? '입주' : '퇴거';
            }
            finalTenant.is_active = finalTenant.status === '입주';

            if (finalTenant.id) {
                await tenantsService.updateTenant(finalTenant.id, finalTenant);
            } else {
                await tenantsService.createTenant(finalTenant as Tenant);
            }
            Alert.alert('\uc131\uacf5', '\uc785\uc8fc\uc0ac \uc815\ubcf4\uac00 \uc800\uc7a5\ub418\uc5c8\uc2b5\ub2c8\ub2e4.');
            loadTenants();
            setIsEditing(false);
            if (onComplete) onComplete();
        } catch (error) {
            console.error(error);
            Alert.alert('\uc624\ub958', '\uc800\uc7a5\uc5d0 \uc2e4\ud328\ud588\uc2b5\ub2c8\ub2e4. DB \uad6c\uc870 \uc5c5\ub370\uc774\ud2b8\ub97c \ud655\uc778\ud574 \uc8fc\uc138\uc694.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (id: string) => {
        Alert.alert('\uc0ad\uc81c \ud655\uc778', '\uc815\ub9d0 \uc774 \uc785\uc8fc\uc0ac\ub97c \uc0ad\uc81c\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?', [
            { text: '\ucde8\uc18c', style: 'cancel' },
            {
                text: '\uc0ad\uc81c',
                style: 'destructive',
                onPress: async () => {
                    await tenantsService.deleteTenant(id);
                    loadTenants();
                    if (onComplete) onComplete();
                }
            }
        ]);
    };

    const formatShortDate = (dateString: string | null) => {
        if (!dateString) return '-';
        const d = new Date(dateString);
        return `${d.getMonth() + 1}/${d.getDate()}`;
    };

    const filteredTenants = tenants
        .filter(t => {
            const query = searchQuery.toLowerCase();
            return (
                t.name.toLowerCase().includes(query) ||
                (t.company_name?.toLowerCase() || '').includes(query) ||
                (t.room_number?.toLowerCase() || '').includes(query) ||
                t.phone.includes(query)
            );
        })
        .sort((a, b) => {
            if (sortOrder === 'recent') {
                const aLast = mailStats[a.id!]?.lastSentAt || '';
                const bLast = mailStats[b.id!]?.lastSentAt || '';
                return bLast.localeCompare(aLast);
            } else if (sortOrder === 'name') {
                return a.name.localeCompare(b.name);
            } else {
                const roomA = a.room_number || '';
                const roomB = b.room_number || '';
                return roomA.localeCompare(roomB, undefined, { numeric: true });
            }
        });

    const activeCount = tenants.filter(t => t.is_active).length;

    if (isEditing) {
        return (
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1, backgroundColor: '#fff' }}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E293B' }}>
                        {editingTenant.id ? '정보 수정' : '신규 등록'}
                    </Text>
                    <Pressable onPress={() => setIsEditing(false)} style={{ marginLeft: 'auto', padding: 5 }}>
                        <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '700' }}>{'리스트로 복귀'}</Text>
                    </Pressable>
                </View>
                <ScrollView contentContainerStyle={styles.editForm}>
                    <View style={styles.compactInputGroup}>
                        <Text style={styles.compactLabel}>회사명</Text>
                        <TextInput
                            style={styles.compactInput}
                            value={editingTenant.company_name}
                            onChangeText={t => setEditingTenant({ ...editingTenant, company_name: t })}
                            placeholder="회사명 입력"
                        />
                    </View>
                    <View style={styles.compactInputGroup}>
                        <Text style={styles.compactLabel}>이름</Text>
                        <TextInput
                            style={styles.compactInput}
                            value={editingTenant.name}
                            onChangeText={t => setEditingTenant({ ...editingTenant, name: t })}
                            placeholder="이름 입력"
                        />
                    </View>
                    <View style={styles.compactInputGroup}>
                        <Text style={styles.compactLabel}>호실</Text>
                        <TextInput
                            style={styles.compactInput}
                            value={editingTenant.room_number}
                            onChangeText={t => setEditingTenant({ ...editingTenant, room_number: t })}
                            placeholder="호실 입력"
                        />
                    </View>
                    <View style={styles.compactInputGroup}>
                        <Text style={styles.compactLabel}>전화번호</Text>
                        <TextInput
                            style={styles.compactInput}
                            value={editingTenant.phone}
                            onChangeText={t => setEditingTenant({ ...editingTenant, phone: t })}
                            placeholder="01012345678"
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={{ marginTop: 8, marginBottom: 10 }}>
                        <Text style={[styles.compactLabel, { marginBottom: 6, width: '100%' }]}>📋 입주 상태</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            {['입주', '퇴거', '폐업', '이전', '소재불명'].map((st) => {
                                const currentStatus = editingTenant.status || (editingTenant.is_active ? '입주' : '퇴거');
                                const isSelected = currentStatus === st;
                                return (
                                    <Pressable
                                        key={st}
                                        onPress={() => setEditingTenant({ ...editingTenant, status: st })}
                                        style={{
                                            flex: 1,
                                            paddingVertical: 8,
                                            borderRadius: 8,
                                            borderWidth: 1,
                                            alignItems: 'center',
                                            backgroundColor: isSelected ? (st === '입주' ? '#10B981' : '#F1F5F9') : '#fff',
                                            borderColor: isSelected ? (st === '입주' ? '#10B981' : '#CBD5E1') : '#E2E8F0'
                                        }}
                                    >
                                        <Text style={{
                                            fontSize: 11,
                                            fontWeight: '800',
                                            color: isSelected ? (st === '입주' ? '#fff' : '#475569') : '#94A3B8'
                                        }}>
                                            {st}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    <View style={[styles.compactInputGroup, { justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 0 }]}>
                        <View>
                            <Text style={styles.compactLabel}>{"프리미엄 서비스"}</Text>
                        </View>
                        <Switch
                            value={editingTenant.is_premium}
                            onValueChange={v => setEditingTenant({ ...editingTenant, is_premium: v })}
                            trackColor={{ true: '#4F46E5', false: '#CBD5E1' }}
                            style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                        />
                    </View>

                    <View style={{ marginTop: 8, marginBottom: 10 }}>
                        <Text style={[styles.compactLabel, { marginBottom: 6, width: '100%' }]}>🖼️ 사진 자동 삭제</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            {[
                                { label: '1주', days: 7 },
                                { label: '2주', days: 14 },
                                { label: '1달', days: 30 },
                                { label: '영구', days: 0 }
                            ].map((item) => (
                                <Pressable
                                    key={item.days}
                                    onPress={() => setEditingTenant({ ...editingTenant, retention_days: item.days })}
                                    style={{
                                        flex: 1,
                                        paddingVertical: 8,
                                        borderRadius: 8,
                                        borderWidth: 1,
                                        alignItems: 'center',
                                        backgroundColor: (editingTenant.retention_days ?? 14) === item.days ? '#0D9488' : '#fff',
                                        borderColor: (editingTenant.retention_days ?? 14) === item.days ? '#0D9488' : '#E2E8F0'
                                    }}
                                >
                                    <Text style={{
                                        fontSize: 11,
                                        fontWeight: '800',
                                        color: (editingTenant.retention_days ?? 14) === item.days ? '#fff' : '#64748B'
                                    }}>
                                        {item.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    <View style={{
                        flexDirection: 'row',
                        gap: 15,
                        marginTop: 10,
                        borderTopWidth: 1,
                        borderTopColor: '#F1F5F9',
                        paddingTop: 15,
                        justifyContent: 'center',
                        alignItems: 'center',
                        width: '100%'
                    }}>
                        <Pressable
                            style={{
                                width: 120,
                                paddingVertical: 10,
                                borderRadius: 10,
                                backgroundColor: '#F1F5F9',
                                borderWidth: 1,
                                borderColor: '#E2E8F0',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onPress={() => setIsEditing(false)}
                        >
                            <Text style={{ color: '#64748B', fontWeight: '800', fontSize: 15 }}>취소</Text>
                        </Pressable>
                        <View style={{ width: 120 }}>
                            <PrimaryButton
                                label="저장하기"
                                onPress={handleSave}
                                loading={loading}
                                style={{ width: '100%', height: 44, alignItems: 'center', justifyContent: 'center' }}
                            />
                        </View>
                    </View>
                    {/* 물리 버튼 겹침 방지 여백 */}
                    <View style={{ height: 60 }} />
                </ScrollView >
            </KeyboardAvoidingView >
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>{'\uc785\uc8fc\uc0ac \uad00\ub9ac'}</Text>
                    <Text style={styles.countText}>{'\uc785\uc8fc'} {activeCount} / {'\uc804\uccb4'} {tenants.length}</Text>
                </View>
                <Pressable onPress={() => { setEditingTenant({ company_id: companyId, is_active: true, is_premium: false, status: '입주', retention_days: 14 }); setIsEditing(true); }} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>+ {'\uc785\uc8fc\uc0ac \ub4f1\ub85d'}</Text>
                </Pressable>
            </View>

            <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#F1F5F9',
                borderRadius: 12,
                paddingHorizontal: 12,
                marginBottom: 15,
                borderWidth: 1,
                borderColor: '#E2E8F0'
            }}>
                <Ionicons name="search" size={20} color="#64748B" />
                <TextInput
                    style={{
                        flex: 1,
                        paddingVertical: 12,
                        paddingHorizontal: 8,
                        fontSize: 15,
                        color: '#1E293B',
                    }}
                    placeholder={'\uc774\ub984, \ud68c\uc0ac\uba85, \ud638\uc2e4, \uc804\ud654\ubc88\ud638 \uac80\uc0c9'}
                    placeholderTextColor="#94A3B8"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            <View style={styles.sortContainer}>
                {(['recent', 'name', 'room'] as const).map(key => (
                    <Pressable key={key} onPress={() => setSortOrder(key)} style={[styles.sortBtn, sortOrder === key && styles.sortBtnActive]}>
                        <Text style={[styles.sortBtnText, sortOrder === key && styles.sortBtnTextActive]}>
                            {key === 'recent' ? '\ucd5c\uc2e0\uc21c' : key === 'name' ? '\uc774\ub984\uc21c' : '\ud638\uc2e4\uc21c'}
                        </Text>
                    </Pressable>
                ))}
            </View>

            {loading && tenants.length === 0 ? (
                <ActivityIndicator style={{ marginTop: 50 }} color="#4F46E5" />
            ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
                    {filteredTenants.map(t => {
                        const stat = mailStats[t.id!];
                        const total = stat?.total || 0;
                        const read = stat?.read || 0;
                        const readRate = total > 0 ? Math.round((read / total) * 100) : 0;
                        return (
                            <Pressable key={t.id} style={styles.tenantCard} onPress={() => { setEditingTenant(t); setIsEditing(true); }}>
                                <View style={styles.tenantInfo}>
                                    {/* 상단 행: 호수와 회사명 */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                        <View style={{ width: 50, marginRight: 12 }}>
                                            <Text style={[styles.roomNumber, { width: '100%', textAlign: 'center', paddingHorizontal: 0, fontSize: 13, paddingVertical: 4 }]}>
                                                {t.room_number || '-'}
                                            </Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.companyName, { fontSize: 16 }]} numberOfLines={1}>
                                                {t.company_name || '(\ubbf8\ub4f1\ub85d)'}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* 하단 행: 배지와 입주자 이름/연락처/통계 */}
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={{ width: 50, marginRight: 12, alignItems: 'center' }}>
                                            <View style={{ flexDirection: 'row', gap: 3 }}>
                                                {t.is_premium && (
                                                    <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: '#C7D2FE', alignItems: 'center' }}>
                                                        <Text style={{ fontSize: 9, color: '#4338CA', fontWeight: '900' }}>P</Text>
                                                    </View>
                                                )}
                                                <View style={{ backgroundColor: t.is_active ? '#F0FDF4' : '#F1F5F9', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, alignItems: 'center' }}>
                                                    <Text style={{ color: t.is_active ? '#166534' : '#475569', fontSize: 9, fontWeight: '800' }}>
                                                        {t.status || (t.is_active ? '입주' : '퇴거')}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                            <Text style={[styles.tenantName, { fontSize: 14, color: '#1E293B', fontWeight: '700' }]} numberOfLines={1}>{t.name}</Text>
                                            <Text style={{ fontSize: 10, color: '#CBD5E1' }}>|</Text>
                                            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>
                                                보관 <Text style={{ color: '#4F46E5' }}>{t.retention_days === 0 ? '영구' : `${(t.retention_days || 14) / 7}주`}</Text>
                                            </Text>
                                            <Text style={{ fontSize: 10, color: '#CBD5E1' }}>|</Text>
                                            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>
                                                개봉 <Text style={{ color: '#059669' }}>{total > 0 ? `${read}/${total}` : '-'}</Text>
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.cardActions}>
                                    <Pressable onPress={() => { setEditingTenant(t); setIsEditing(true); }} style={styles.editBtn}>
                                        <Text style={styles.editBtnText}>{'\uc218\uc815'}</Text>
                                    </Pressable>
                                    <Pressable onPress={() => handleDelete(t.id!)} style={styles.deleteBtn}>
                                        <Text style={styles.deleteBtnText}>{'\uc0ad\uc81c'}</Text>
                                    </Pressable>
                                </View>
                            </Pressable>
                        );
                    })}
                    {filteredTenants.length === 0 && (
                        <Text style={styles.emptyText}>{'\uac80\uc0c9 \uacb0\uacfc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.'}</Text>
                    )}
                </ScrollView>
            )}
        </View>
    );
});

const styles = StyleSheet.create({
    container: { flex: 1, padding: 15 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    title: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
    countText: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 2 },
    addBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 10 },
    addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    searchBarContainer: { marginBottom: 10 },
    searchInput: { backgroundColor: '#F1F5F9', padding: 12, borderRadius: 10, fontSize: 15, color: '#1E293B' },
    sortContainer: { flexDirection: 'row', gap: 8, marginBottom: 15 },
    sortBtn: { backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
    sortBtnActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
    sortBtnText: { color: '#64748B', fontSize: 12, fontWeight: '600' },
    sortBtnTextActive: { color: '#fff' },
    tenantCard: { backgroundColor: '#fff', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
    tenantInfo: { flex: 1 },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    roomNumber: { fontSize: 13, fontWeight: '800', color: '#6366F1', backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' },
    companyName: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    tenantName: { fontSize: 14, color: '#64748B', fontWeight: '500' },
    badgeRow: { flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
    badgeText: { fontSize: 11, fontWeight: '700' },
    statsRow: { flexDirection: 'row', gap: 16 },
    mailStatBox: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    mailStatLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
    mailStatValue: { fontSize: 13, fontWeight: '800', color: '#334155' },
    cardActions: { justifyContent: 'space-around', alignItems: 'flex-end', marginLeft: 10 },
    editBtn: { padding: 4 },
    editBtnText: { color: '#4F46E5', fontSize: 13, fontWeight: '600' },
    deleteBtn: { padding: 4 },
    deleteBtnText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
    editForm: { padding: 20 },
    formTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 25 },
    inputGroup: { marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: '#64748B', marginBottom: 6 },
    input: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 12, fontSize: 16, color: '#1E293B' },
    switchGroup: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    formButtons: { flexDirection: 'row', gap: 10, marginTop: 20, justifyContent: 'flex-end' },
    cancelBtn: { paddingHorizontal: 20, paddingVertical: 12, justifyContent: 'center' },
    cancelBtnText: { color: '#64748B', fontWeight: '600' },
    emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 40 },
    // Compact Edit Form Styles
    compactInputGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    compactLabel: {
        width: 100,
        fontSize: 14,
        fontWeight: '700',
        color: '#64748B'
    },
    compactInput: {
        flex: 1,
        fontSize: 15,
        color: '#1E293B',
        fontWeight: '600',
        paddingVertical: 4
    }
});
