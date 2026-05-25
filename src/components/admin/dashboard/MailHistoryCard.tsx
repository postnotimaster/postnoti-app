import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';

interface MailHistoryCardProps {
    log: any;
    pushStatuses?: Record<string, boolean>; // [추가] 전체 푸시 현황판
    onPress: (tenant: any) => void;
}

export const MailHistoryCard: React.FC<MailHistoryCardProps> = ({ log, pushStatuses, onPress }) => {
    // [개선] 하이픈 제거 후 숫자만으로 푸시 가능 여부 판별 (100% 매칭 보장)
    const normalizedPhone = log.tenants?.phone ? log.tenants.phone.replace(/[^0-9]/g, '') : null;
    const isPushAvailable = log.tenants?.profile_id || (normalizedPhone && pushStatuses?.[normalizedPhone]);

    return (
        <View style={{ paddingHorizontal: 20, backgroundColor: '#fff' }}>
            <Pressable
                style={{
                    flexDirection: 'row',
                    padding: 12,
                    backgroundColor: '#fff',
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: '#F1F5F9',
                    justifyContent: 'center',
                    marginBottom: 10,
                    elevation: 2,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 2,
                }}
                onPress={() => {
                    if (log.tenants) {
                        onPress(log.tenants);
                    }
                }}
            >
                <Image
                    source={log.image_url ? { uri: log.image_url } : { uri: 'https://via.placeholder.com/50' }}
                    style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: '#E2E8F0', marginRight: 12 }}
                    resizeMode="cover"
                />
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    {/* 첫 번째 행: 호수와 회사명 */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <View style={{ width: 50, marginRight: 12 }}>
                            <Text style={{ width: '100%', textAlign: 'center', fontSize: 13, fontWeight: '900', color: '#6366F1', backgroundColor: '#EEF2FF', paddingVertical: 4, borderRadius: 6, overflow: 'hidden' }}>
                                {log.tenants?.room_number || '-'}
                            </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E293B' }} numberOfLines={1}>
                                {log.tenants?.company_name || '(미등록)'}
                            </Text>
                        </View>
                    </View>

                    {/* 두 번째 행: 배지와 입주자 이름 */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2 }}>
                        <View style={{ width: 50, marginRight: 12, alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', gap: 3 }}>
                                {log.tenants?.is_premium && (
                                    <View style={{ 
                                        backgroundColor: '#78350F',
                                        paddingHorizontal: 6, 
                                        paddingVertical: 2, 
                                        borderRadius: 4, 
                                        borderWidth: 1, 
                                        borderColor: '#D97706',
                                        alignItems: 'center'
                                    }}>
                                        <Text style={{ fontSize: 8, color: '#FDE68A', fontWeight: '900', letterSpacing: 0.8 }}>PREMIUM</Text>
                                    </View>
                                )}
                                {log.tenants?.is_active === false && (
                                    <View style={{ backgroundColor: '#FEF2F2', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: '#FECACA', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 9, color: '#991B1B', fontWeight: '900' }}>퇴거</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '600' }} numberOfLines={1}>
                                {log.tenants?.name}
                            </Text>
                            {/* [개선] 하이픈 제거 후 숫자만으로 푸시 상태 판별 */}
                            {(() => {
                                const normPhone = log.tenants?.phone ? log.tenants.phone.replace(/[^0-9]/g, '') : '';
                                const isApp = log.tenants?.profile_id || (normPhone && pushStatuses?.[normPhone]);
                                return (
                                    <View style={{ 
                                        backgroundColor: isApp ? '#DBEAFE' : '#F1F5F9', 
                                        paddingHorizontal: 6, 
                                        paddingVertical: 2, 
                                        borderRadius: 6 
                                    }}>
                                        <Text style={{ fontSize: 9, fontWeight: '900', color: isApp ? '#2563EB' : '#94A3B8' }}>
                                            {isApp ? 'APP' : 'SMS'}
                                        </Text>
                                    </View>
                                );
                            })()}
                        </View>
                    </View>

                    {/* 세 번째 행: OCR 내용 */}
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 50, marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 12, color: '#94A3B8' }} numberOfLines={1}>
                                {log.ocr_content || ''}
                            </Text>
                        </View>
                    </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>
                        {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </Text>
                    <View style={{ 
                        backgroundColor: log.read_at ? '#DCFCE7' : '#FEF2F2', 
                        paddingHorizontal: 8, 
                        paddingVertical: 3, 
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: log.read_at ? '#BBF7D0' : '#FECACA'
                    }}>
                        <Text style={{ 
                            fontSize: 11, 
                            color: log.read_at ? '#16A34A' : '#EF4444', 
                            fontWeight: '800' 
                        }}>
                            {log.read_at ? '✓ 읽음' : '미개봉'}
                        </Text>
                    </View>
                </View>
            </Pressable>
        </View>
    );
};
