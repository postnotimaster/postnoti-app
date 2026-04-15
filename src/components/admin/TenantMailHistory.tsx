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
    Dimensions
} from 'react-native';
import { mailService } from '../../services/mailService';
import { Tenant } from '../../services/tenantsService';
import { supabase } from '../../lib/supabase';
import { ReactNativeZoomableView } from '@openspacelabs/react-native-zoomable-view';

interface TenantMailHistoryProps {
    tenant: Tenant;
    onClose: () => void;
    isTenantMode?: boolean;
}

export const TenantMailHistory = ({ tenant, onClose, isTenantMode = false }: TenantMailHistoryProps) => {
    const [mails, setMails] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedFullImage, setSelectedFullImage] = useState<string | null>(null);

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

    return (
        <View style={styles.container}>
            {loading ? (
                <ActivityIndicator style={{ marginTop: 50 }} color="#4F46E5" size="large" />
            ) : (
                <ScrollView contentContainerStyle={styles.list}>
                    {mails.map(mail => (
                        <View key={mail.id} style={styles.card}>
                            <View style={styles.headerRow}>
                                <View style={{ flexDirection: 'row', gap: 6 }}>
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{mail.mail_type}</Text>
                                    </View>
                                    {mail.read_at ? (
                                        <View style={[styles.badge, { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' }]}>
                                            <Text style={[styles.badgeText, { color: '#15803D' }]}>읽음</Text>
                                        </View>
                                    ) : (
                                        <View style={[styles.badge, { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }]}>
                                            <Text style={[styles.badgeText, { color: '#94A3B8' }]}>안읽음</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.date}>{formatDate(mail.created_at)}</Text>
                            </View>

                            {mail.image_url ? (
                                <Pressable onPress={() => {
                                    setSelectedFullImage(mail.image_url);
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
                                <View style={[styles.image, styles.noImage]}>
                                    <Text style={{ color: '#CBD5E1' }}>No Image</Text>
                                </View>
                            )}

                            <View style={styles.info}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.senderLabel}>보낸 분</Text>
                                        <Text style={styles.sender}>
                                            {mail.ocr_content || '(발신처 미상)'}
                                        </Text>
                                    </View>
                                    {!isTenantMode && (
                                        <Pressable
                                            style={styles.resendBtn}
                                            onPress={async () => {
                                                if (!tenant.profile_id) {
                                                    Alert.alert('알림 불가', '이 입주사는 앱 계정이 연결되어 있지 않습니다. 문자로 링크를 공유해 주세요.');
                                                    return;
                                                }

                                                // Fetch latest profile data
                                                const { data: profile } = await supabase
                                                    .from('profiles')
                                                    .select('*')
                                                    .eq('id', tenant.profile_id)
                                                    .single();

                                                if (!profile?.push_token && !profile?.web_push_token) {
                                                    Alert.alert('알림 불가', '이 입주민은 알림 수신 설정이 되어있지 않습니다.');
                                                    return;
                                                }

                                                Alert.alert('알림 재발송', `${tenant.name}님께 알림을 다시 보내시겠습니까?`, [
                                                    { text: '취소', style: 'cancel' },
                                                    {
                                                        text: '보내기',
                                                        onPress: async () => {
                                                            const title = `[우편물 도착] ${mail.mail_type} 알림 재발송 🔔`;
                                                            const sender = mail.ocr_content || '발신처';
                                                            const body = `${sender}에서 보낸 ${mail.mail_type} 우편물이 도착했습니다. (관리자 재발송)`;

                                                            // Fetch company slug
                                                            let companySlug = '';
                                                            try {
                                                                const { data: compData } = await supabase
                                                                    .from('companies')
                                                                    .select('slug')
                                                                    .eq('id', mail.company_id)
                                                                    .single();
                                                                if (compData) companySlug = compData.slug;
                                                            } catch (e) { }

                                                            const deepLinkUrl = companySlug ? `postnoti://branch/${companySlug}` : 'postnoti://branch';
                                                            const webLinkUrl = companySlug ? `https://postnoti-app.vercel.app/branch/${companySlug}` : 'https://postnoti-app.vercel.app/branch';

                                                            try {
                                                                if (profile.push_token) {
                                                                    await fetch('https://exp.host/--/api/v2/push/send', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({
                                                                            to: profile.push_token,
                                                                            sound: 'default',
                                                                            title,
                                                                            body,
                                                                            data: { url: deepLinkUrl }
                                                                        })
                                                                    });
                                                                } else if (profile.web_push_token) {
                                                                    await fetch('https://postnoti-app.vercel.app/api/send-push', {
                                                                        method: 'POST',
                                                                        headers: { 'Content-Type': 'application/json' },
                                                                        body: JSON.stringify({
                                                                            token: profile.web_push_token,
                                                                            title,
                                                                            body,
                                                                            data: {
                                                                                company_id: mail.company_id,
                                                                                url: webLinkUrl
                                                                            }
                                                                        })
                                                                    });
                                                                }
                                                                Alert.alert('성공', '알림을 재발송했습니다.');
                                                            } catch (e) {
                                                                Alert.alert('실패', '알림 발송 중 오류가 발생했습니다.');
                                                            }
                                                        }
                                                    }
                                                ]);
                                            }}
                                        >
                                            <Text style={styles.resendBtnText}>🔔 재발송</Text>
                                        </Pressable>
                                    )}
                                </View>
                            </View>

                            {/* 프리미엄 추가 촬영 이미지들 */}
                            {mail.extra_images && mail.extra_images.length > 0 && (
                                <View style={{ padding: 15, paddingTop: 0 }}>
                                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#6366F1', marginBottom: 8 }}>
                                        📄 상세 페이지 ({mail.extra_images.length})
                                    </Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                        <View style={{ flexDirection: 'row', gap: 10 }}>
                                            {(() => {
                                                let images: string[] = [];
                                                if (Array.isArray(mail.extra_images)) {
                                                    images = mail.extra_images;
                                                } else if (typeof mail.extra_images === 'string') {
                                                    try {
                                                        const parsed = JSON.parse(mail.extra_images);
                                                        if (Array.isArray(parsed)) images = parsed;
                                                    } catch (e) { }
                                                }
                                                return images.map((img: string, idx: number) => (
                                                    <Pressable key={idx} onPress={() => setSelectedFullImage(img)}>
                                                        <Image
                                                            source={{ uri: img }}
                                                            style={{ width: 100, height: 130, borderRadius: 8, backgroundColor: '#F1F5F9' }}
                                                            resizeMode="cover"
                                                        />
                                                    </Pressable>
                                                ));
                                            })()}
                                        </View>
                                    </ScrollView>
                                </View>
                            )}
                        </View>
                    ))}
                    {mails.length === 0 && (
                        <Text style={styles.emptyText}>우편물 수령 내역이 없습니다.</Text>
                    )}
                </ScrollView>
            )}

            {/* 전체 화면 이미지 확대 (View 기반으로 변경하여 중첩 모달 문제 해결) */}
            {!!selectedFullImage && (
                <View style={[styles.fullImageContainer, StyleSheet.absoluteFill, { zIndex: 9999 }]}>
                    <Pressable
                        style={styles.closeArea}
                        onPress={() => setSelectedFullImage(null)}
                    >
                        <Text style={styles.closeText}>✕ 닫기</Text>
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
                            style={styles.fullImage}
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
    image: { width: '100%', height: 300, backgroundColor: '#000' },
    zoomHint: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    zoomHintText: { color: '#fff', fontSize: 11, fontWeight: '600' },
    noImage: { alignItems: 'center', justifyContent: 'center', height: 150, backgroundColor: '#F1F5F9' },
    info: { padding: 15, backgroundColor: '#fff' },
    senderLabel: { fontSize: 12, color: '#94A3B8', marginBottom: 4 },
    sender: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
    emptyText: { textAlign: 'center', color: '#94A3B8', marginTop: 50, fontSize: 15 },

    // 확대 모달 관련 스타일
    fullImageContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
    zoomWrapper: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
    fullImage: { width: Dimensions.get('window').width, height: Dimensions.get('window').height * 0.8 },
    closeArea: { position: 'absolute', top: 50, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 20 },
    closeText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    zoomFooter: { position: 'absolute', bottom: 40, width: '100%', alignItems: 'center' },
    zoomFooterText: { color: '#fff', fontSize: 12, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },

    // 줌 헤더 스타일
    zoomHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 60, paddingBottom: 20, gap: 12, zIndex: 100 },
    zoomControlBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    zoomControlText: { color: '#fff', fontSize: 20, fontWeight: '700' },
    zoomPercentText: { color: '#fff', fontSize: 14, fontWeight: '600', width: 45, textAlign: 'center' },

    // 재발송 버튼 스타일
    resendBtn: { backgroundColor: '#EEF2FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#C7D2FE' },
    resendBtnText: { color: '#4F46E5', fontSize: 13, fontWeight: '700' }
});
