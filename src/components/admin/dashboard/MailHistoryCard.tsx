import React from 'react';
import { View, Text, Pressable, Image } from 'react-native';

interface MailHistoryCardProps {
    log: any;
    onPress: (tenant: any) => void;
}

export const MailHistoryCard: React.FC<MailHistoryCardProps> = ({ log, onPress }) => {
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
                    alignItems: 'center',
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
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 2, gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#6366F1', backgroundColor: '#EEF2FF', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' }}>
                            {log.tenants?.room_number || '-'}
                        </Text>
                        <Text style={{ fontSize: 15, fontWeight: '800', color: '#1E293B' }}>
                            {log.tenants?.company_name || '(미등록)'}
                        </Text>
                        <Text style={{ fontSize: 13, color: '#64748B' }}>{log.tenants?.name}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <Text style={{ fontSize: 13, color: '#475569', flex: 1 }} numberOfLines={1}>
                            {log.ocr_content || ''}
                        </Text>
                        {log.tenants?.is_active === false && (
                            <View style={{ backgroundColor: '#FEF2F2', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 }}>
                                <Text style={{ fontSize: 9, color: '#991B1B', fontWeight: '700' }}>퇴거</Text>
                            </View>
                        )}
                        {log.tenants?.is_premium && (
                            <View style={{ backgroundColor: '#EEF2FF', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, borderWidth: 1, borderColor: '#C7D2FE' }}>
                                <Text style={{ fontSize: 9, color: '#4338CA', fontWeight: '700' }}>P</Text>
                            </View>
                        )}
                    </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>
                        {new Date(log.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                    </Text>
                    <View style={{ backgroundColor: log.read_at ? '#DCFCE7' : '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, color: log.read_at ? '#15803D' : '#64748B', fontWeight: '600' }}>
                            {log.read_at ? '읽음' : '미개봉'}
                        </Text>
                    </View>
                </View>
            </Pressable>
        </View>
    );
};
