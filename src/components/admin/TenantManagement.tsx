import React, { useState, useEffect } from 'react';
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
import { tenantsService, Tenant } from '../../services/tenantsService';
import { PrimaryButton } from '../common/PrimaryButton';

type MailStats = Record<string, { total: number; read: number; lastSentAt: string | null }>;

interface TenantManagementProps {
    companyId: string;
    onComplete: () => void;
    onCancel: () => void;
}

export const TenantManagement = ({ companyId, onComplete, onCancel }: TenantManagementProps) => {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [mailStats, setMailStats] = useState<MailStats>({});
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortOrder, setSortOrder] = useState<'recent' | 'name' | 'room'>('recent');
    const [isEditing, setIsEditing] = useState(false);
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

    useEffect(() => {
        const backAction = () => {
            if (isEditing) {
                setIsEditing(false);
                return true;
            }
            return false;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [isEditing]);

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
            if (editingTenant.id) {
                await tenantsService.updateTenant(editingTenant.id, editingTenant);
            } else {
                await tenantsService.createTenant(editingTenant as Tenant);
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
                <ScrollView contentContainerStyle={styles.editForm}>
                    <Text style={styles.formTitle}>{editingTenant.id ? '\uc785\uc8fc\uc0ac \uc815\ubcf4 \uc218\uc815' : '\uc2e0\uaddc \uc785\uc8fc\uc0ac \ub4f1\ub85d'}</Text>
                    <View style={styles.compactInputGroup}>
                        <Text style={styles.compactLabel}>{'\ud68c\uc0ac\uba85'}</Text>
                        <TextInput
                            style={styles.compactInput}
                            value={editingTenant.company_name}
                            onChangeText={t => setEditingTenant({ ...editingTenant, company_name: t })}
                            placeholder={'\ud68c\uc0ac\uba85\uc744 \uc785\ub825\ud558\uc138\uc694'}
                        />
                    </View>
                    <View style={styles.compactInputGroup}>
                        <Text style={styles.compactLabel}>{'\uc774\ub984'}</Text>
                        <TextInput
                            style={styles.compactInput}
                            value={editingTenant.name}
                            onChangeText={t => setEditingTenant({ ...editingTenant, name: t })}
                            placeholder={'\uc774\ub984\uc744 \uc785\ub825\ud558\uc138\uc694'}
                        />
                    </View>
                    <View style={styles.compactInputGroup}>
                        <Text style={styles.compactLabel}>{'\ud638\uc2e4'}</Text>
                        <TextInput
                            style={styles.compactInput}
                            value={editingTenant.room_number}
                            onChangeText={t => setEditingTenant({ ...editingTenant, room_number: t })}
                            placeholder={'\uc608: 301\ud638'}
                        />
                    </View>
                    <View style={styles.compactInputGroup}>
                        <Text style={styles.compactLabel}>{'\uc804\ud654\ubc88\ud638'}</Text>
                        <TextInput
                            style={styles.compactInput}
                            value={editingTenant.phone}
                            onChangeText={t => setEditingTenant({ ...editingTenant, phone: t })}
                            placeholder="01012345678"
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={[styles.compactInputGroup, { justifyContent: 'space-between', paddingVertical: 10 }]}>
                        <Text style={styles.compactLabel}>{'\uc785\uc8fc \uc0c1\ud0dc'}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 13, color: editingTenant.is_active ? '#10B981' : '#EF4444', fontWeight: '800' }}>
                                {editingTenant.is_active ? '입주중' : '퇴거'}
                            </Text>
                            <Switch
                                value={editingTenant.is_active}
                                onValueChange={v => setEditingTenant({ ...editingTenant, is_active: v })}
                                trackColor={{ true: '#10B981', false: '#CBD5E1' }}
                            />
                        </View>
                    </View>

                    <View style={[styles.compactInputGroup, { justifyContent: 'space-between', paddingVertical: 10 }]}>
                        <View>
                            <Text style={styles.compactLabel}>{'\ud504\ub9ac\ubbf8\uc5c4 \uc11c\ube44\uc2a4'}</Text>
                            <Text style={{ fontSize: 10, color: '#94A3B8' }}>{'\uc6b0\ud3b8 \ubc30\uc1a1\ubb3c \uac1c\ubd09 \ucd2c\uc601'}</Text>
                        </View>
                        <Switch
                            value={editingTenant.is_premium}
                            onValueChange={v => setEditingTenant({ ...editingTenant, is_premium: v })}
                            trackColor={{ true: '#4F46E5', false: '#CBD5E1' }}
                        />
                    </View>

                    <View style={{ marginTop: 15, marginBottom: 20 }}>
                        <Text style={[styles.compactLabel, { marginBottom: 10, width: '100%' }]}>🖼️ 사진 자동 삭제 (보존 기간)</Text>
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
                                        paddingVertical: 10,
                                        borderRadius: 10,
                                        borderWidth: 1,
                                        alignItems: 'center',
                                        backgroundColor: (editingTenant.retention_days ?? 14) === item.days ? '#4F46E5' : '#fff',
                                        borderColor: (editingTenant.retention_days ?? 14) === item.days ? '#4F46E5' : '#E2E8F0'
                                    }}
                                >
                                    <Text style={{
                                        fontSize: 12,
                                        fontWeight: '800',
                                        color: (editingTenant.retention_days ?? 14) === item.days ? '#fff' : '#64748B'
                                    }}>
                                        {item.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    <View style={[styles.formButtons, { marginTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 20 }]}>
                        <Pressable style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
                            <Text style={styles.cancelBtnText}>{'\ucde8\uc18c'}</Text>
                        </Pressable>
                        <View style={{ flex: 1 }}>
                            <PrimaryButton label={'\uc800\uc7a5\ud558\uae30'} onPress={handleSave} loading={loading} />
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
                <Pressable onPress={() => { setEditingTenant({ company_id: companyId, is_active: true, is_premium: false }); setIsEditing(true); }} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>+ {'\uc785\uc8fc\uc0ac \ub4f1\ub85d'}</Text>
                </Pressable>
            </View>

            <View style={styles.searchBarContainer}>
                <TextInput style={styles.searchInput} placeholder={'\uc774\ub984, \ud68c\uc0ac\uba85, \ud638\uc2e4, \uc804\ud654\ubc88\ud638 \uac80\uc0c9'} value={searchQuery} onChangeText={setSearchQuery} />
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
                                    <View style={styles.nameRow}>
                                        <Text style={styles.roomNumber}>{t.room_number || '-'}</Text>
                                        <Text style={styles.companyName}>{t.company_name || '(\ubbf8\ub4f1\ub85d)'}</Text>
                                        <Text style={styles.tenantName}>{t.name}</Text>
                                    </View>
                                    <View style={styles.badgeRow}>
                                        <View style={[styles.badge, { backgroundColor: t.is_active ? '#F0FDF4' : '#FEF2F2' }]}>
                                            <Text style={[styles.badgeText, { color: t.is_active ? '#166534' : '#991B1B' }]}>
                                                {t.is_active ? '\uc785\uc8fc\uc911' : '\ud1f4\uac70'}
                                            </Text>
                                        </View>
                                        <View style={[styles.badge, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0', borderWidth: 1 }]}>
                                            <Text style={[styles.badgeText, { color: '#64748B' }]}>
                                                {t.retention_days === 0 ? '영구' : `${(t.retention_days || 14) / 7}주`}
                                            </Text>
                                        </View>
                                        {t.is_premium && (
                                            <View style={[styles.badge, { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE', borderWidth: 1 }]}>
                                                <Text style={[styles.badgeText, { color: '#4338CA' }]}>Premium</Text>
                                            </View>
                                        )}
                                        {t.profile_id && (
                                            <View style={[styles.badge, { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD', borderWidth: 1 }]}>
                                                <Text style={[styles.badgeText, { color: '#0369A1' }]}>{'\ud83d\udcf1 \uc5f0\uacb0'}</Text>
                                            </View>
                                        )}
                                    </View>
                                    <View style={styles.statsRow}>
                                        <View style={styles.mailStatBox}>
                                            <Text style={styles.mailStatLabel}>{'\uc6b0\ud3b8 \uac1c\ubd09\ub960'}</Text>
                                            <Text style={[
                                                styles.mailStatValue,
                                                total > 0 && readRate < 50 && { color: '#DC2626' },
                                                total > 0 && readRate >= 50 && readRate < 80 && { color: '#D97706' },
                                                total > 0 && readRate >= 80 && { color: '#059669' },
                                            ]}>
                                                {total > 0 ? `${read}/${total}` : '-'}
                                            </Text>
                                        </View>
                                        <View style={styles.mailStatBox}>
                                            <Text style={styles.mailStatLabel}>{'\ucd5c\uadfc \ubc1c\uc1a1'}</Text>
                                            <Text style={styles.mailStatValue}>{formatShortDate(stat?.lastSentAt || null)}</Text>
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
};

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
    tenantCard: { backgroundColor: '#fff', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
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
        paddingVertical: 12,
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
