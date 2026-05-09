import { View, Text, Pressable, Image, ScrollView, StyleSheet, Alert, Platform } from 'react-native';
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
            if (!item.read_at) {
                onMarkRead(item.id);
                mailService.markAsRead(item.id).catch((error) => {
                    console.error('Failed to mark as read:', error);
                    Alert.alert('통신 오류', '서버 통신 불안정으로 읽음 처리가 반영되지 않았을 수 있습니다.');
                });
            }
        }
    };

    const handleDownload = (uri: string) => {
        if (Platform.OS === 'web') {
            const link = document.createElement('a');
            link.href = uri;
            link.download = `postnoti_mail_${item.id}.jpg`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            Alert.alert('알림', '브라우저에서 열기 후 이미지를 길게 눌러 저장하실 수 있습니다.');
        }
    };

    // extra_images parsing
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
                        {item.read_at ? (
                            <View style={[itemStyles.badge, { backgroundColor: '#F1F5F9' }]}>
                                <Text style={[itemStyles.badgeText, { color: '#64748B' }]}>읽음</Text>
                            </View>
                        ) : (
                            <View style={[itemStyles.badge, { backgroundColor: '#FEF2F2' }]}>
                                <Text style={[itemStyles.badgeText, { color: '#DC2626' }]}>안읽음</Text>
                            </View>
                        )}
                        <Text style={itemStyles.date}>
                            {new Date(item.created_at).toLocaleDateString()}
                        </Text>
                    </View>
                </View>

                <View style={{ marginTop: 8 }}>
                    {item.image_url && (
                        <Pressable 
                            style={itemStyles.downloadBtn} 
                            onPress={() => handleDownload(item.image_url!)}
                        >
                            <Ionicons name="download-outline" size={16} color="#4F46E5" />
                            <Text style={itemStyles.downloadText}>이미지 저장</Text>
                        </Pressable>
                    )}
                </View>

                {extraImages.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
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
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    badgeText: { fontSize: 12, fontWeight: '800' },
    date: { fontSize: 13, color: '#94A3B8', marginLeft: 4 },
    downloadBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F3FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, gap: 4, alignSelf: 'flex-start' },
    downloadText: { fontSize: 12, fontWeight: '700', color: '#4F46E5' },
    extraThumb: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    mainImage: { width: 80, height: 80, borderRadius: 14, marginLeft: 12, backgroundColor: '#F1F5F9' },
});
