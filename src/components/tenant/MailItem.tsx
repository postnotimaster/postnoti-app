import { View, Text, Pressable, Image, StyleSheet, Alert } from 'react-native';
import { mailService } from '../../services/mailService';
import Ionicons from '@expo/vector-icons/Ionicons';

export type MailLog = {
    id: string;
    mail_type: string;
    ocr_content: string | null;
    image_url: string | null;
    extra_images: string[] | string | null;
    read_at: string | null;
    created_at: string;
    status: string;
    tenant_id?: string;
    profile_id?: string;
};

type Props = {
    item: MailLog;
    onImagePress: (uri: string) => void;
    onMarkRead: (id: string) => void;
};

export const MailItem = ({ item, onImagePress, onMarkRead }: Props) => {
    const handlePress = () => {
        if (item.image_url) {
            onImagePress(item.image_url);
        }
        if (!item.read_at) {
            onMarkRead(item.id);
            mailService.markAsRead(item.id).catch((error) => {
                console.error('Failed to mark as read:', error);
                Alert.alert('통신 오류', '서버 통신 불안정으로 읽음 처리가 반영되지 않았을 수 있습니다.');
            });
        }
    };

    // Parse extra images
    const extraImages: string[] = (() => {
        if (Array.isArray(item.extra_images)) return item.extra_images;
        if (typeof item.extra_images === 'string') {
            try {
                const parsed = JSON.parse(item.extra_images);
                if (Array.isArray(parsed)) return parsed;
            } catch {
                if (item.extra_images.startsWith('http')) return [item.extra_images];
            }
        }
        return [];
    })();

    // Date formatting and 'Just Arrived' logic
    const createdAt = new Date(item.created_at);
    const now = new Date();
    const diffMs = now.getTime() - createdAt.getTime();
    const isJustArrived = !item.read_at && diffMs < 30 * 60 * 1000; // Unread + within 30 mins

    const formatDateTime = (date: Date) => {
        const yy = String(date.getFullYear()).slice(2);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const hours = date.getHours();
        const mins = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? '오후' : '오전';
        const displayHours = hours % 12 || 12;
        return `${yy}.${mm}.${dd} ${ampm} ${displayHours}:${mins}`;
    };

    return (
        <Pressable 
            style={[
                itemStyles.container, 
                isJustArrived && itemStyles.containerHighlight,
                item.read_at && itemStyles.containerRead
            ]} 
            onPress={handlePress}
        >
            {/* Left: Thumbnail */}
            {item.image_url ? (
                <View style={itemStyles.thumbWrapper}>
                    <Image source={{ uri: item.image_url }} style={itemStyles.thumbImage} resizeMode="cover" />
                    {extraImages.length > 0 && (
                        <View style={itemStyles.extraBadge}>
                            <Ionicons name="images-outline" size={10} color="#fff" />
                            <Text style={itemStyles.extraBadgeText}>+{extraImages.length}</Text>
                        </View>
                    )}
                </View>
            ) : (
                <View style={[itemStyles.thumbWrapper, itemStyles.thumbPlaceholder]}>
                    <Ionicons name="mail-outline" size={24} color="#94A3B8" />
                </View>
            )}

            {/* Middle: Content */}
            <View style={itemStyles.content}>
                <View style={itemStyles.titleRow}>
                    <Text style={[itemStyles.title, !item.read_at && itemStyles.titleUnread]}>
                        {!item.read_at ? '새로운 우편물' : '읽은 우편물'}
                    </Text>
                    {isJustArrived && (
                        <View style={itemStyles.newBadge}>
                            <Text style={itemStyles.newBadgeText}>방금 도착</Text>
                        </View>
                    )}
                </View>
                <Text style={itemStyles.dateText}>{formatDateTime(createdAt)}</Text>
            </View>

            {/* Right: Status */}
            <View style={itemStyles.statusWrapper}>
                {!item.read_at ? (
                    <View style={itemStyles.unreadDot} />
                ) : (
                    <Text style={itemStyles.readText}>읽음</Text>
                )}
            </View>
        </Pressable>
    );
};

const itemStyles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    containerHighlight: {
        backgroundColor: '#FEFCE8',
        borderColor: '#FEF08A',
    },
    containerRead: {
        backgroundColor: '#F8FAFC',
        shadowOpacity: 0,
        elevation: 0,
        opacity: 0.6,
    },
    thumbWrapper: {
        width: 56,
        height: 56,
        borderRadius: 14,
        marginRight: 16,
        backgroundColor: '#F1F5F9',
        overflow: 'hidden',
        position: 'relative',
    },
    thumbImage: {
        width: '100%',
        height: '100%',
    },
    thumbPlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    extraBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: 'rgba(0,0,0,0.6)',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 2,
    },
    extraBadgeText: {
        color: '#fff',
        fontSize: 9,
        fontWeight: 'bold',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
        gap: 6,
    },
    title: {
        fontSize: 15,
        color: '#64748B',
        fontWeight: '500',
    },
    titleUnread: {
        color: '#0F172A',
        fontWeight: '800',
    },
    newBadge: {
        backgroundColor: '#EF4444',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    newBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '800',
    },
    dateText: {
        fontSize: 13,
        color: '#94A3B8',
        fontWeight: '500',
    },
    statusWrapper: {
        width: 40,
        alignItems: 'flex-end',
        justifyContent: 'center',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#EF4444',
    },
    readText: {
        fontSize: 12,
        color: '#CBD5E1',
        fontWeight: '500',
    },
});
