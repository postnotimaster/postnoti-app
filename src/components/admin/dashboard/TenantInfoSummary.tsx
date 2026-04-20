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
        <View style={{ padding: 15, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                    <View style={{ marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <Text style={{ fontSize: 13, fontWeight: '800', color: '#6366F1', backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, overflow: 'hidden' }}>
                                {tenant?.room_number || '-'}
                            </Text>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B' }}>
                                {tenant?.company_name || '(미등록)'}
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 15, color: '#475569', fontWeight: '600' }}>{tenant?.name}</Text>
                            {tenant?.phone && (
                                <Pressable
                                    onPress={() => Linking.openURL(`tel:${tenant.phone}`)}
                                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: '#BAE6FD' }}
                                >
                                    <Ionicons name="call" size={12} color="#0369A1" style={{ marginRight: 4 }} />
                                    <Text style={{ fontSize: 12, color: '#0369A1', fontWeight: '800' }}>{tenant.phone}</Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                    <View style={{ gap: 6, alignItems: 'flex-start', marginTop: 4 }}>
                        {/* 입주 상태 배지 */}
                        <View style={{ backgroundColor: tenant?.status === '입주' || (!tenant?.status && tenant?.is_active) ? '#059669' : '#64748B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} />
                            <Text style={{ fontSize: 11, fontWeight: '900', color: '#fff' }}>
                                {tenant?.status || (tenant?.is_active ? '입주중' : '퇴거')}
                            </Text>
                        </View>

                        {/* 보관 정책 및 개봉 현황 */}
                        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                            <View
                                style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 30, borderWidth: 1, borderColor: '#C7D2FE' }}
                            >
                                <Text style={{ fontSize: 10, color: '#4338CA', fontWeight: '800' }}>
                                    {tenant?.retention_days === 0 ? '영구보관' : `${(tenant?.retention_days ?? 14) / 7}주보관`}
                                </Text>
                            </View>

                            {tenant?.id && mailStats[tenant.id] && (() => {
                                const s = mailStats[tenant.id!];
                                return (
                                    <View style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 30, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                        <Text style={{ fontSize: 10, fontWeight: '800', color: '#475569' }}>
                                            개봉 {s.read}/{s.total}
                                        </Text>
                                    </View>
                                );
                            })()}
                        </View>
                    </View>
                </View>
                <Pressable onPress={onClose} style={{ padding: 15, marginRight: -10 }}>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#64748B' }}>✕</Text>
                </Pressable>
            </View>
        </View>
    );
};
