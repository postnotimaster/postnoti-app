import React from 'react';
import { View, Text, Pressable, Image, ScrollView, StyleSheet } from 'react-native';
import { mailService } from '../../services/mailService';

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
            if (!item.read_at) {
                mailService.markAsRead(item.id);
                onMarkRead(item.id);
            }
        }
    };

    // extra_images parsing (handles both array and JSON string)
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

    return (
        <Pressable style={itemStyles.container} onPress={handlePress}>
            <View style={itemStyles.info}>
                <View style={itemStyles.header}>
                    <View style={itemStyles.row}>
                        <Text style={itemStyles.mailType}>{item.mail_type}</Text>
                        {item.read_at ? (
                            <View style={[itemStyles.badge, { backgroundColor: '#DCFCE7' }]}>
                                <Text style={[itemStyles.badgeText, { color: '#15803D' }]}>읽음</Text>
                            </View>
                        ) : (
                            <View style={[itemStyles.badge, { backgroundColor: '#FEF2F2' }]}>
                                <Text style={[itemStyles.badgeText, { color: '#DC2626' }]}>안읽음</Text>
                            </View>
                        )}
                    </View>
                    <Text style={itemStyles.date}>
                        {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                </View>
                <Text style={itemStyles.content} numberOfLines={2}>
                    {item.ocr_content || '내용 없음'}
                </Text>
                {item.image_url && (
                    <View style={itemStyles.row}>
                        <View style={[itemStyles.badge, { backgroundColor: '#EFF6FF' }]}>
                            <Text style={[itemStyles.badgeText, { color: '#1E40AF' }]}>📷 사진 보기</Text>
                        </View>
                        {extraImages.length > 0 && (
                            <View style={[itemStyles.badge, { backgroundColor: '#EEF2FF' }]}>
                                <Text style={[itemStyles.badgeText, { color: '#4338CA' }]}>📄 +{extraImages.length}페이지</Text>
                            </View>
                        )}
                    </View>
                )}
                {extraImages.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={itemStyles.extraScroll}>
                        <View style={itemStyles.row}>
                            {extraImages.map((img, idx) => (
                                <Pressable key={idx} onPress={() => onImagePress(img)}>
                                    <Image
                                        source={{ uri: img }}
                                        style={itemStyles.extraThumb}
                                        resizeMode="cover"
                                    />
                                </Pressable>
                            ))}
                        </View>
                    </ScrollView>
                )}
            </View>
            {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={itemStyles.mainImage} resizeMode="cover" />
            ) : null}
        </Pressable>
    );
};

const itemStyles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
        flexDirection: 'row',
    },
    info: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    row: { flexDirection: 'row', gap: 6 },
    mailType: { fontSize: 13, fontWeight: '700', color: '#4F46E5', backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
    badgeText: { fontSize: 11, fontWeight: '600' },
    date: { fontSize: 12, color: '#94A3B8' },
    content: { fontSize: 14, color: '#334155', marginBottom: 8, lineHeight: 20 },
    extraScroll: { marginTop: 10 },
    extraThumb: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    mainImage: { width: 70, height: 70, borderRadius: 12, marginLeft: 12, backgroundColor: '#F1F5F9' },
});
