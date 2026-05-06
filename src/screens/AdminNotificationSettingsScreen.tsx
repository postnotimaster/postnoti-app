import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { supabase } from '../lib/supabase';

export const AdminNotificationSettingsScreen = () => {
    const { officeInfo } = useAuth();
    const { setMode } = useUI();
    const [loading, setLoading] = useState(false);
    const [defaultMessage, setDefaultMessage] = useState('안녕하세요. 우편물이 도착했습니다.');
    const [presets, setPresets] = useState<string[]>([]);
    const [newPreset, setNewPreset] = useState('');
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [editingText, setEditingText] = useState('');

    useEffect(() => {
        if (officeInfo?.id) {
            loadSettings();
        }
    }, [officeInfo?.id]);

    const loadSettings = async () => {
        if (!officeInfo?.id) return;
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('companies')
                .select('settings')
                .eq('id', officeInfo.id)
                .single();

            // 컬럼이 없거나 에러가 나도 기본값 유지
            if (error) {
                console.log('Settings column might be missing, using defaults:', error.message);
                return;
            }

            if (data?.settings) {
                const settings = data.settings;
                if (settings.default_message) setDefaultMessage(settings.default_message);
                if (settings.notification_presets) setPresets(settings.notification_presets);
            }
        } catch (error) {
            console.error('Load settings unexpected error:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveSettings = async (updatedDefault?: string, updatedPresets?: string[]) => {
        if (!officeInfo?.id) return;
        
        try {
            const currentSettings = {
                default_message: updatedDefault !== undefined ? updatedDefault : defaultMessage,
                notification_presets: updatedPresets !== undefined ? updatedPresets : presets
            };

            const { error } = await supabase
                .from('companies')
                .update({ settings: currentSettings })
                .eq('id', officeInfo.id);

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Save settings error:', error);
            Alert.alert('오류', '설정 저장 중 문제가 발생했습니다.');
            return false;
        }
    };

    const handleAddPreset = async () => {
        if (!newPreset.trim()) return;
        const updated = [...presets, newPreset.trim()];
        setPresets(updated);
        setNewPreset('');
        await saveSettings(undefined, updated);
    };

    const handleDeletePreset = (index: number) => {
        Alert.alert('삭제', '이 메시지를 삭제하시겠습니까?', [
            { text: '취소', style: 'cancel' },
            {
                text: '삭제',
                style: 'destructive',
                onPress: async () => {
                    const updated = presets.filter((_, i) => i !== index);
                    setPresets(updated);
                    await saveSettings(undefined, updated);
                }
            }
        ]);
    };

    const startEditing = (index: number) => {
        setEditingIndex(index);
        setEditingText(presets[index]);
    };

    const saveEdit = async () => {
        if (editingIndex === null || !editingText.trim()) return;
        const updated = [...presets];
        updated[editingIndex] = editingText.trim();
        setPresets(updated);
        setEditingIndex(null);
        await saveSettings(undefined, updated);
    };

    return (
        <SafeAreaView style={appStyles.safeArea} edges={['top', 'left', 'right']}>
            <AppHeader title="알림 메시지 설정" onBack={() => setMode('admin_menu')} />
            
            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 20 }}>
                    {loading ? (
                        <ActivityIndicator color="#4F46E5" style={{ marginTop: 50 }} />
                    ) : (
                        <>
                            {/* 1. 기본 메시지 설정 */}
                            <View style={{ marginBottom: 30 }}>
                                <Text style={[appStyles.label, { marginBottom: 8 }]}>기본 알림 메시지</Text>
                                <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 12 }}>
                                    메시지를 따로 선택하지 않았을 때 발송되는 기본 문구입니다.
                                </Text>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <TextInput
                                        style={[appStyles.input, { flex: 1, marginBottom: 0 }]}
                                        value={defaultMessage}
                                        onChangeText={setDefaultMessage}
                                        placeholder="기본 메시지를 입력하세요"
                                    />
                                    <Pressable 
                                        onPress={() => saveSettings(defaultMessage)}
                                        style={{ backgroundColor: '#4F46E5', paddingHorizontal: 15, borderRadius: 12, justifyContent: 'center' }}
                                    >
                                        <Text style={{ color: '#fff', fontWeight: '700' }}>저장</Text>
                                    </Pressable>
                                </View>
                            </View>

                            <View style={appStyles.menuSeparator} />

                            {/* 2. 빠른 메시지(프리셋) 관리 */}
                            <View style={{ marginTop: 20 }}>
                                <Text style={[appStyles.label, { marginBottom: 8 }]}>빠른 메시지 리스트</Text>
                                <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 15 }}>
                                    우편물 등록 시 선택할 수 있는 자주 쓰는 메시지들입니다.
                                </Text>

                                {/* 메시지 추가 */}
                                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                                    <TextInput
                                        style={[appStyles.input, { flex: 1, marginBottom: 0 }]}
                                        value={newPreset}
                                        onChangeText={setNewPreset}
                                        placeholder="새 메시지 추가..."
                                    />
                                    <Pressable 
                                        onPress={handleAddPreset}
                                        style={{ backgroundColor: '#1E293B', paddingHorizontal: 15, borderRadius: 12, justifyContent: 'center' }}
                                    >
                                        <Ionicons name="add" size={24} color="#fff" />
                                    </Pressable>
                                </View>

                                {/* 프리셋 목록 */}
                                <View style={{ gap: 10 }}>
                                    {presets.map((item, index) => (
                                        <View key={index} style={{ backgroundColor: '#fff', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center' }}>
                                            {editingIndex === index ? (
                                                <>
                                                    <TextInput
                                                        style={[appStyles.input, { flex: 1, marginBottom: 0, paddingVertical: 5 }]}
                                                        value={editingText}
                                                        onChangeText={setEditingText}
                                                        autoFocus
                                                    />
                                                    <Pressable onPress={saveEdit} style={{ marginLeft: 10 }}>
                                                        <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                                                    </Pressable>
                                                    <Pressable onPress={() => setEditingIndex(null)} style={{ marginLeft: 5 }}>
                                                        <Ionicons name="close-circle" size={24} color="#94A3B8" />
                                                    </Pressable>
                                                </>
                                            ) : (
                                                <>
                                                    <Text style={{ flex: 1, fontSize: 14, color: '#334155' }}>{item}</Text>
                                                    <Pressable onPress={() => startEditing(index)} style={{ padding: 5 }}>
                                                        <Ionicons name="pencil-outline" size={18} color="#64748B" />
                                                    </Pressable>
                                                    <Pressable onPress={() => handleDeletePreset(index)} style={{ padding: 5, marginLeft: 5 }}>
                                                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                                    </Pressable>
                                                </>
                                            )}
                                        </View>
                                    ))}
                                    {presets.length === 0 && (
                                        <Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 20, fontSize: 13 }}>
                                            등록된 빠른 메시지가 없습니다.
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </>
                    )}
                    <View style={{ height: 100 }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};
