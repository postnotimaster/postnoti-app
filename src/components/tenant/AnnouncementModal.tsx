import React, { useState } from 'react';
import {
    View, Text, Pressable, Modal, ScrollView,
    TouchableWithoutFeedback, StyleSheet, Dimensions
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Announcement } from '../../services/noticeService';

type Props = {
    visible: boolean;
    announcements: Announcement[];
    onClose: () => void;
};

export const AnnouncementModal = ({ visible, announcements, onClose }: Props) => {
    const [selectedNotice, setSelectedNotice] = useState<Announcement | null>(null);

    const handleClose = () => {
        setSelectedNotice(null);
        onClose();
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="slide"
            onRequestClose={handleClose}
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>
                            {selectedNotice ? '공지사항 상세' : '공지사항 목록'}
                        </Text>
                        <Pressable onPress={handleClose} style={styles.closeBtn}>
                            <Ionicons name="close" size={24} color="#64748B" />
                        </Pressable>
                    </View>

                    {selectedNotice ? (
                        // 상세 보기
                        <View style={styles.detailContainer}>
                            <Pressable
                                onPress={() => setSelectedNotice(null)}
                                style={styles.backBtn}
                            >
                                <Ionicons name="chevron-back" size={18} color="#4F46E5" />
                                <Text style={styles.backBtnText}>목록으로</Text>
                            </Pressable>

                            <ScrollView style={styles.scrollView}>
                                <View style={styles.detailHeader}>
                                    {selectedNotice.priority > 0 && (
                                        <View style={styles.priorityBadge}>
                                            <Text style={styles.priorityBadgeText}>중요</Text>
                                        </View>
                                    )}
                                    <Text style={styles.detailTitle}>{selectedNotice.title}</Text>
                                    <Text style={styles.detailDate}>{formatDate(selectedNotice.created_at)}</Text>
                                </View>
                                <View style={styles.divider} />
                                <Text style={styles.detailBody}>{selectedNotice.content}</Text>
                            </ScrollView>
                        </View>
                    ) : (
                        // 목록 보기
                        <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingBottom: 20 }}>
                            {announcements.length > 0 ? (
                                announcements.map((notice) => (
                                    <Pressable
                                        key={notice.id}
                                        style={styles.noticeItem}
                                        onPress={() => setSelectedNotice(notice)}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <View style={styles.noticeItemHeader}>
                                                {notice.priority > 0 && (
                                                    <View style={styles.itemPriorityBadge}>
                                                        <Text style={styles.itemPriorityText}>중요</Text>
                                                    </View>
                                                )}
                                                <Text style={styles.noticeItemTitle} numberOfLines={1}>
                                                    {notice.title}
                                                </Text>
                                            </View>
                                            <Text style={styles.noticeItemDate}>{formatDate(notice.created_at)}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                                    </Pressable>
                                ))
                            ) : (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>등록된 공지사항이 없습니다.</Text>
                                </View>
                            )}
                        </ScrollView>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    content: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        height: Dimensions.get('window').height * 0.8,
        paddingTop: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1E293B',
    },
    closeBtn: {
        padding: 4,
    },
    scrollView: {
        flex: 1,
        paddingHorizontal: 24,
    },
    noticeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    noticeItemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 6,
    },
    noticeItemTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#334155',
        flex: 1,
    },
    noticeItemDate: {
        fontSize: 12,
        color: '#94A3B8',
    },
    itemPriorityBadge: {
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    itemPriorityText: {
        color: '#EF4444',
        fontSize: 10,
        fontWeight: '800',
    },
    detailContainer: {
        flex: 1,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingVertical: 12,
        gap: 4,
    },
    backBtnText: {
        color: '#4F46E5',
        fontSize: 14,
        fontWeight: '700',
    },
    detailHeader: {
        marginTop: 10,
        marginBottom: 20,
    },
    detailTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#1E293B',
        marginBottom: 8,
    },
    detailDate: {
        fontSize: 13,
        color: '#64748B',
    },
    priorityBadge: {
        backgroundColor: '#EF4444',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 10,
    },
    priorityBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '800',
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginBottom: 20,
    },
    detailBody: {
        fontSize: 15,
        lineHeight: 24,
        color: '#475569',
    },
    emptyContainer: {
        marginTop: 100,
        alignItems: 'center',
    },
    emptyText: {
        color: '#94A3B8',
        fontSize: 14,
    }
});
