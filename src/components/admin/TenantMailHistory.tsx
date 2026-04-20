import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Image,
    Alert,
    Pressable,
    ActivityIndicator,
    Modal,
    Dimensions,
    Linking
} from 'react-native';
import { mailService } from '../../services/mailService';
import { Tenant } from '../../services/tenantsService';
import { Company } from '../../services/companiesService';
import { supabase } from '../../lib/supabase';
import { ReactNativeZoomableView } from '@openspacelabs/react-native-zoomable-view';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { storageService } from '../../services/storageService';
import { useAppContent } from '../../contexts/AppContext';
import { notificationService } from '../../services/notificationService';

interface TenantMailHistoryProps {
    tenant: Tenant;
    officeInfo?: Company;
    onClose: () => void;
    isTenantMode?: boolean;
}

export const TenantMailHistory = ({ tenant, officeInfo, onClose, isTenantMode = false }: TenantMailHistoryProps) => {
    const [mails, setMails] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);
    const [imageRotation, setImageRotation] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const { optimizeImage } = useAppContent() as any;

    useEffect(() => {
        loadHistory();
    }, []);

    const loadHistory = async () => {
        try {
            if (tenant.id) {
                const data = await mailService.getMailsByTenant(tenant.id);
                setMails(data || []);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('오류', '이력을 불러오지 못했습니다.');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return `${date.getFullYear()}. ${String(date.getMonth() + 1).padStart(2, '0')}. ${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    };

    const handleAddPhoto = async (mailId: string, fromCamera: boolean) => {
        try {
            const result = fromCamera
                ? await ImagePicker.launchCameraAsync({ quality: 0.5 })
                : await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });

            if (result.canceled) return;

            setIsUploading(true);
            const localUri = result.assets[0].uri;
            const optimized = await optimizeImage(localUri);
            const publicUrl = await storageService.uploadImage(optimized);

            if (!publicUrl) throw new Error('파일 업로드에 실패했습니다.');

            // 현재 메일의 extra_images 가져오기
            const currentMail = mails.find(m => m.id === mailId);
            let currentExtras: string[] = [];
            if (Array.isArray(currentMail.extra_images)) {
                currentExtras = currentMail.extra_images;
            } else if (typeof currentMail.extra_images === 'string' && currentMail.extra_images) {
                try { currentExtras = JSON.parse(currentMail.extra_images); } catch (e) { }
            }

            const updatedExtras = [...currentExtras, publicUrl];
            console.log('📸 Updating Extra Photos:', { mailId, currentExtras: currentExtras.length, updated: updatedExtras.length });
            const { error } = await mailService.updateMailExtraImages(mailId, updatedExtras);

            if (error) {
                console.error('❌ updateMailExtraImages Error:', error);
                throw error;
            }

            // 로컬 상태 업데이트
            setMails(prev => prev.map(m => m.id === mailId ? { ...m, extra_images: updatedExtras } : m));

            // 푸시 알람 발송 (지점 정보가 있을 경우에만)
            if (officeInfo) {
                const title = `[${officeInfo.name}] 추가 촬영 완료 📸`;
                const body = `${tenant.company_name || tenant.name}님, 요청하신 우편물의 추가 상세 사진이 등록되었습니다.`;

                notificationService.sendPushNotification(
                    tenant,
                    officeInfo,
                    '시스템',
                    '추가촬영',
                    body
                ).catch(e => console.warn('Extra photo push failed:', e));
            }

            Alert.alert('성공', '추가 사진이 등록되었습니다.');

        } catch (e: any) {
            console.error('Failed to add photo:', e);
            Alert.alert('오류', e.message || '사진 등록 중 오류가 발생했습니다.');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <View style={styles.container}>
            {loading ? (
                <ActivityIndicator style={{ marginTop: 50 }} color="#4F46E5" size="large" />
            ) : (
                <ScrollView contentContainerStyle={styles.list}>
                    {mails.map(mail => (
                        <View key={mail.id} style={styles.card}>
                            <View style={styles.headerRow}>
                                <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                    {mail.read_at ? (
                                        <View style={[styles.badge, { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' }]}>
                                            <Text style={[styles.badgeText, { color: '#15803D' }]}>읽음</Text>
                                        </View>
                                    ) : (
                                        <View style={[styles.badge, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                                            <Text style={[styles.badgeText, { color: '#94A3B8' }]}>안읽음</Text>
                                        </View>
                                    )}
                                    {!isTenantMode && (
                                        <Pressable
                                            style={[styles.resendBtn, { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center' }]}
                                            onPress={async () => {
                                                const link = `https://postnoti-app-two.vercel.app/view?p=${tenant.id}`;

                                                if (!tenant.profile_id) {
                                                    Alert.alert('회원 미연동', '이 입주사는 앱 계정이 연결되어 있지 않습니다. 아래 전용 링크를 문자로 보내시겠습니까?', [
                                                        { text: '취소', style: 'cancel' },
                                                        {
                                                            text: '문자 보내기',
                                                            onPress: () => {
                                                                const message = `[Postnoti] ${tenant.company_name || tenant.name}님, 도착한 우편물을 확인하세요.\n\n확인링크: ${link}`;
                                                                Linking.openURL(`sms:${tenant.phone}?body=${encodeURIComponent(message)}`);
                                                            }
                                                        }
                                                    ]);
                                                    return;
                                                }

                                                const { data: profile } = await supabase
                                                    .from('profiles')
                                                    .select('*')
                                                    .eq('id', tenant.profile_id)
                                                    .single();

                                                if (!profile?.push_token && !profile?.web_push_token) {
                                                    Alert.alert('알림 불가', '이 입주민은 알림 수신 설정이 되어있지 않습니다. 문자로 전용 링크를 보내시겠습니까?', [
                                                        { text: '취소', style: 'cancel' },
                                                        {
                                                            text: '문자 보내기',
                                                            onPress: () => {
                                                                const message = `[Postnoti] ${tenant.company_name || tenant.name}님, 도착한 우편물을 확인하세요.\n\n확인링크: ${link}`;
                                                                Linking.openURL(`sms:${tenant.phone}?body=${encodeURIComponent(message)}`);
                                                            }
                                                        }
                                                    ]);
                                                    return;
                                                }

                                                Alert.alert('알림 재발송', `${tenant.name}님께 앱 푸시 알림을 다시 보내시겠습니까?`, [
                                                    { text: '취소', style: 'cancel' },
                                                    {
                                                        text: '푸시 보내기',
                                                        onPress: async () => {
                                                            const body = `새로운 우편물이 도착했습니다. 터치하여 확인하세요.`;

                                                            const success = await notificationService.sendPushNotification(
                                                                tenant,
                                                                officeInfo!,
                                                                tenant.name,
                                                                '일반',
                                                                body
                                                            );

                                                            if (success) Alert.alert('성공', '알림이 재발송되었습니다.');
                                                            else Alert.alert('실패', '알림 발송 중 오류가 발생했습니다. 문자로 보내보세요.');
                                                        }
                                                    }
                                                ]);
                                            }}
                                        >
                                            <Ionicons name="notifications-outline" size={14} color="#4F46E5" style={{ marginRight: 4 }} />
                                            <Text style={[styles.resendBtnText, { fontSize: 12 }]}>재발송</Text>
                                        </Pressable>
                                    )}
                                </View>
                                <Text style={styles.date}>{formatDate(mail.created_at)}</Text>
                            </View>

                            {mail.image_url ? (
                                <Pressable onPress={() => {
                                    setSelectedFullImage(mail.image_url);
                                    setImageRotation(0);
                                    if (isTenantMode && !mail.read_at) {
                                        mailService.markAsRead(mail.id);
                                        setMails(prev => prev.map(m => m.id === mail.id ? { ...m, read_at: new Date().toISOString() } : m));
                                    }
                                }}>
                                    <Image
                                        source={{ uri: mail.image_url }}
                                        style={styles.image}
                                        resizeMode="contain"
                                    />

                                    <View style={styles.zoomHint}>
                                        <Text style={styles.zoomHintText}>
                                            {isTenantMode && !mail.read_at ? '📩 터치하여 확인(읽음처리)' : '🔍 터치하여 확대'}
                                        </Text>
                                    </View>
                                </Pressable>
                            ) : (
                                <View style={[styles.image, styles.noImage, { padding: 20 }]}>
                                    <Ionicons name="document-text-outline" size={32} color="#CBD5E1" style={{ marginBottom: 10 }} />
                                    <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center', fontWeight: '600' }}>
                                        보관 기간 만료 (사진 삭제)
                                    </Text>
                                    <View style={{ marginTop: 15, backgroundColor: '#fff', padding: 12, borderRadius: 10, width: '100%', borderWidth: 1, borderColor: '#E2E8F0' }}>
                                        <Text style={{ color: '#1E293B', fontSize: 14, fontWeight: '800', textAlign: 'center' }} numberOfLines={3}>
                                            {mail.ocr_content || '내용 없음'}
                                        </Text>
                                    </View>
                                </View>
                            )}

                            <View style={styles.info}>
                                <Text style={styles.sender}>
                                    {mail.ocr_content || ''}
                                </Text>
                            </View>

                            {/* 프리미엄 추가 촬영 이미지들/등록 버튼 */}
                            {(mail.extra_images && mail.extra_images.length > 0) || (!isTenantMode && tenant.is_premium) ? (
                                <View style={{ padding: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F8FAFC' }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: '#6366F1' }}>
                                            📄 상세 페이지 {mail.extra_images?.length > 0 ? `(${mail.extra_images.length})` : ''}
                                        </Text>
                                        {!isTenantMode && tenant.is_premium && (
                                            <Pressable
                                                onPress={() => {
                                                    Alert.alert('이미지 추가', '어디서 사진을 가져올까요?', [
                                                        { text: '📷 촬영하기', onPress: () => handleAddPhoto(mail.id, true) },
                                                        { text: '🖼️ 앨범에서 선택', onPress: () => handleAddPhoto(mail.id, false) },
                                                        { text: '취소', style: 'cancel' }
                                                    ]);
                                                }}
                                                disabled={isUploading}
                                                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#C7D2FE' }}
                                            >
                                                {isUploading ? (
                                                    <ActivityIndicator size="small" color="#4F46E5" />
                                                ) : (
                                                    <>
                                                        <Ionicons name="add-circle-outline" size={14} color="#4F46E5" style={{ marginRight: 4 }} />
                                                        <Text style={{ fontSize: 12, color: '#4F46E5', fontWeight: '700' }}>추가 촬영</Text>
                                                    </>
                                                )}
                                            </Pressable>
                                        )}
                                    </View>

                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        <View style={{ flexDirection: 'row', gap: 10 }}>
                                            {(() => {
                                                const rawExtra = mail.extra_images;
                                                let displayImages: string[] = [];
                                                if (Array.isArray(rawExtra)) {
                                                    displayImages = rawExtra;
                                                } else if (typeof rawExtra === 'string' && rawExtra) {
                                                    try {
                                                        const parsed = JSON.parse(rawExtra);
                                                        if (Array.isArray(parsed)) displayImages = parsed;
                                                    } catch (e) { }
                                                }

                                                return (
                                                    <>
                                                        {displayImages.map((img: string, idx: number) => (
                                                            <Pressable key={`extra-${idx}`} onPress={() => { setSelectedFullImage(img); setImageRotation(0); }}>
                                                                <Image
                                                                    source={{ uri: img }}
                                                                    style={{ width: 100, height: 130, borderRadius: 8, backgroundColor: '#F1F5F9' }}
                                                                    resizeMode="cover"
                                                                />
                                                            </Pressable>
                                                        ))}
                                                        {!isTenantMode && tenant.is_premium && displayImages.length === 0 && (
                                                            <View style={{ width: 100, height: 130, borderRadius: 8, borderStyle: 'dotted', borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                                                                <Text style={{ color: '#94A3B8', fontSize: 10 }}>대기중</Text>
                                                            </View>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </View>
                                    </ScrollView>
                                </View>
                            ) : null}

                        </View>
                    ))}
                    {mails.length === 0 && (
                        <Text style={styles.emptyText}>우편물 수령 내역이 없습니다.</Text>
                    )}
                </ScrollView>
            )}

            {/* 전체 화면 이미지 확대 */}
            {!!selectedFullImage && (
                <View style={[styles.fullImageContainer, StyleSheet.absoluteFill, { zIndex: 9999 }]}>
                    <Pressable
                        style={styles.closeArea}
                        onPress={() => setSelectedFullImage(null)}
                    >
                        <Text style={styles.closeText}>✕ 닫기</Text>
                    </Pressable>

                    <Pressable
                        style={styles.rotateArea}
                        onPress={() => setImageRotation(r => r + 90)}
                    >
                        <Text style={styles.rotateText}>↻ 회전</Text>
                    </Pressable>

                    <ReactNativeZoomableView
                        maxZoom={5}
                        minZoom={1}
                        initialZoom={1}
                        bindToBorders={true}
                        style={styles.zoomWrapper}
                    >
                        <Image
                            source={{ uri: selectedFullImage }}
                            style={[styles.fullImage, { transform: [{ rotate: `${imageRotation}deg` }] }]}
                            resizeMode="contain"
                        />
                    </ReactNativeZoomableView>
                    <View style={styles.zoomFooter}>
                        <Text style={styles.zoomFooterText}>💡 두 손가락으로 벌려 확대할 수 있습니다</Text>
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    list: { padding: 20, paddingBottom: 100 },
    card: { backgroundColor: '#fff', borderRadius: 16, marginBottom: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', backgroundColor: '#fff' },
    badge: { backgroundColor: '#F0F9FF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#E0F2FE' },
    badgeText: { color: '#0369A1', fontWeight: '700', fontSize: 13 },
    date: { color: '#64748B', fontSize: 14, fontWeight: '600' },
    image: { width: '100%', height: 180, backgroundColor: '#F1F5F9' },
    zoomHint: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    zoomHintText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    noImage: { alignItems: 'center', justifyContent: 'center', height: 150, backgroundColor: '#F1F5F9' },
    info: { padding: 15, backgroundColor: '#fff' },
    sender: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
    emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 50, fontSize: 15 },
    fullImageContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
    zoomWrapper: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.8 },
    closeArea: { position: 'absolute', top: 30, right: 15, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 25 },
    closeText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    rotateArea: { position: 'absolute', top: 30, right: 85, zIndex: 10, backgroundColor: 'rgba(79,70,229,0.8)', padding: 10, paddingHorizontal: 15, borderRadius: 20 },
    rotateText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    zoomFooter: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' },
    zoomFooterText: { color: '#fff', fontSize: 12, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
    resendBtn: { backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#C7D2FE' },
    resendBtnText: { color: '#4F46E5', fontSize: 13, fontWeight: '700' }
});
