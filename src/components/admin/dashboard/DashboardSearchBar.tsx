import React from 'react';
import { View, TextInput, Pressable, ActivityIndicator, Text } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface DashboardSearchBarProps {
    isSearchFocused: boolean;
    logSearchQuery: string;
    setLogSearchQuery: (q: string) => void;
    initialLoading: boolean;
    onSearchFocus: () => void;
    onSearchBlur: () => void;
    dateFilter: number | undefined;
    setDateFilter: (val: number | undefined) => void;
}

export const DashboardSearchBar: React.FC<DashboardSearchBarProps> = ({
    isSearchFocused,
    logSearchQuery,
    setLogSearchQuery,
    initialLoading,
    onSearchFocus,
    onSearchBlur,
    dateFilter,
    setDateFilter
}) => {
    return (
        <View style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
            <View style={{
                position: 'relative',
                height: 48,
                justifyContent: 'center',
                backgroundColor: '#F8FAFC',
                borderRadius: 14,
                borderWidth: 1,
                borderColor: isSearchFocused ? '#4F46E5' : '#E2E8F0',
            }}>
                <Ionicons name="search-outline" size={20} color={isSearchFocused ? '#4F46E5' : '#94A3B8'} style={{ position: 'absolute', left: 16, zIndex: 1 }} />
                <TextInput
                    style={{
                        height: 48,
                        paddingLeft: 48,
                        paddingRight: 40,
                        fontSize: 15,
                        color: '#1E293B',
                        fontWeight: '600',
                        paddingVertical: 0
                    }}
                    placeholder="이름, 회사명, 호실 검색"
                    placeholderTextColor="#94A3B8"
                    value={logSearchQuery}
                    onChangeText={setLogSearchQuery}
                    onFocus={onSearchFocus}
                    onBlur={onSearchBlur}
                />
                {(initialLoading || logSearchQuery.length > 0) && (
                    <Pressable
                        onPress={() => setLogSearchQuery('')}
                        style={{ position: 'absolute', right: 12, padding: 4 }}
                    >
                        {initialLoading ? (
                            <ActivityIndicator size="small" color="#4F46E5" />
                        ) : (
                            <Ionicons name="close-circle" size={20} color="#CBD5E1" />
                        )}
                    </Pressable>
                )}
            </View>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                {[
                    { l: '전체', v: undefined },
                    { l: '1개월', v: 1 },
                    { l: '3개월', v: 3 },
                    { l: '6개월', v: 6 }
                ].map(f => (
                    <Pressable
                        key={f.l}
                        onPress={() => setDateFilter(f.v)}
                        style={{
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 10,
                            backgroundColor: dateFilter === f.v ? '#1E293B' : '#F1F5F9',
                            borderWidth: 1,
                            borderColor: dateFilter === f.v ? '#1E293B' : '#E2E8F0'
                        }}
                    >
                        <Text style={{
                            fontSize: 12,
                            fontWeight: '700',
                            color: dateFilter === f.v ? '#fff' : '#64748B'
                        }}>{f.l}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
};
