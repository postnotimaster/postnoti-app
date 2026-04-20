import React from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Pressable, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAnnouncements } from '../../hooks/tenant/useAnnouncements';
import { useAppContent } from '../../contexts/AppContext';

export const NoticeListScreen = () => {
    const { brandingCompany, tenantProfile } = useAppContent();
    const { announcements, loading, refreshAnnouncements } = useAnnouncements({
        companyId: brandingCompany?.id || '',
        tenantId: tenantProfile?.tenant_id || tenantProfile?.id
    });

    const renderNoticeItem = ({ item }: { item: any }) => (
        <View style={styles.noticeCard}>
            <View style={styles.noticeHeader}>
                <Text style={styles.noticeDate}>
                    {new Date(item.created_at).toLocaleDateString()}
                </Text>
                {item.priority > 0 && (
                    <View style={styles.importantBadge}>
                        <Text style={styles.importantText}>중요</Text>
                    </View>
                )}
            </View>
            <Text style={styles.noticeTitle}>{item.title}</Text>
            <Text style={styles.noticeContent}>{item.content}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>공지사항</Text>
                <Pressable onPress={() => refreshAnnouncements()} disabled={loading}>
                    <Ionicons name="refresh" size={20} color="#64748B" />
                </Pressable>
            </View>

            {loading ? (
                <ActivityIndicator style={{ marginTop: 50 }} color="#4F46E5" />
            ) : (
                <FlatList
                    data={announcements}
                    keyExtractor={(item) => item.id}
                    renderItem={renderNoticeItem}
                    contentContainerStyle={{ padding: 20 }}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="notifications-off-outline" size={48} color="#CBD5E1" />
                            <Text style={styles.emptyText}>등록된 공지사항이 없습니다.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        paddingTop: Platform.OS === 'ios' ? 60 : 40,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: '#fff',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
    noticeCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    noticeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    noticeDate: { fontSize: 13, color: '#94A3B8' },
    importantBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
    importantText: { fontSize: 11, fontWeight: '800', color: '#EF4444' },
    noticeTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
    noticeContent: { fontSize: 14, color: '#475569', lineHeight: 22 },
    emptyContainer: { alignItems: 'center', marginTop: 100, gap: 16 },
    emptyText: { color: '#94A3B8', fontSize: 15 }
});
