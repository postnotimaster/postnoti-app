import React from 'react';
import { View, Text, Pressable, Linking } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface TenantInfoSummaryProps {
    tenant: any;
    mailStats: any;
    onClose: () => void;
}

export const TenantInfoSummary: React.FC<TenantInfoSummaryProps> = ({ tenant, mailStats, onClose }) => {
    return (
        <View style={{ backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
            <View style={{ padding: 16 }}>
                {/* 상단 닫기 버튼 영역 분리 (안전 지대 확보) */}
                <View style={{ position: 'absolute', right: 5, top: 5, zIndex: 10 }}>
                    <Pressable onPress={onClose} style={{ padding: 12 }}>
                        <Ionicons name="close" size={24} color="#94A3B8" />
                    </Pressable>
                </View>

                {/* 첫 번째 영역: 호수와 회사명 (큰 글씨) */}
                <View style={{ paddingRight: 45, marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                        <View style={{
                            backgroundColor: '#EEF2FF',
                            paddingHorizontal: 10,
                            paddingVertical: 3,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: '#C7D2FE'
                        }}>
                            <Text style={{ fontSize: 13, fontWeight: '900', color: '#6366F1' }}>
                                {tenant?.room_number || '-'}
                            </Text>
                        </View>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B', flexShrink: 1 }}>
                            {tenant?.company_name || '(미등록)'}
                        </Text>
                    </View>
                </View>

                {/* 두 번째 영역: 입주자 상세 정보 (카드 형태) */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#F8FAFC',
                    padding: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: '#E2E8F0'
                }}>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Text style={{ fontSize: 16, fontWeight: '800', color: '#334155' }}>
                                {tenant?.name}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 3 }}>
                                {tenant?.is_premium && (
                                    <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                                        <Text style={{ fontSize: 9, color: '#4338CA', fontWeight: '900' }}>P</Text>
                                    </View>
                                )}
                                <View style={{
                                    backgroundColor: tenant?.status === '입주' || (!tenant?.status && tenant?.is_active) ? '#059669' : '#64748B',
                                    paddingHorizontal: 6,
                                    paddingVertical: 1,
                                    borderRadius: 4
                                }}>
                                    <Text style={{ fontSize: 9, fontWeight: '900', color: '#fff' }}>
                                        {tenant?.status || (tenant?.is_active ? '입주' : '퇴거')}
                                    </Text>
                                </View>
                            </View>
                        </View>
                        <Text style={{ fontSize: 14, color: '#64748B', fontWeight: '600' }}>
                            {tenant?.phone || '연락처 없음'}
                        </Text>
                    </View>

                    {tenant?.phone && (
                        <Pressable
                            onPress={() => Linking.openURL(`tel:${tenant.phone}`)}
                            style={{
                                backgroundColor: '#4F46E5',
                                width: 38,
                                height: 38,
                                borderRadius: 19,
                                justifyContent: 'center',
                                alignItems: 'center',
                                elevation: 2,
                                shadowColor: '#4F46E5',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.15,
                                shadowRadius: 3
                            }}
                        >
                            <Ionicons name="call" size={18} color="#fff" />
                        </Pressable>
                    )}
                </View>

                {/* 세 번째 영역: 보관 정책 및 통계 */}
                <View style={{ flexDirection: 'row', gap: 15, marginTop: 15, paddingHorizontal: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="shield-checkmark" size={12} color="#94A3B8" />
                        <Text style={{ fontSize: 11, color: '#64748B' }}>보관: </Text>
                        <Text style={{ fontSize: 11, color: '#334155', fontWeight: '800' }}>
                            {tenant?.retention_days === 0 ? '영구' : `${(tenant?.retention_days ?? 14) / 7}주`}
                        </Text>
                    </View>
                    <View style={{ width: 1, height: 10, backgroundColor: '#E2E8F0', alignSelf: 'center' }} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="mail-open-outline" size={12} color="#94A3B8" />
                        <Text style={{ fontSize: 11, color: '#64748B' }}>개봉률: </Text>
                        {tenant?.id && mailStats[tenant.id] ? (
                            <Text style={{ fontSize: 11, color: '#059669', fontWeight: '800' }}>
                                {mailStats[tenant.id].read}/{mailStats[tenant.id].total}
                            </Text>
                        ) : (
                            <Text style={{ fontSize: 11, color: '#94A3B8' }}>-</Text>
                        )}
                    </View>
                </View>
            </View>
        </View>
    );
};
