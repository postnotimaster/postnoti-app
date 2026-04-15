import React from 'react';
import {
    View, Text, Pressable, Modal, Switch,
    TouchableWithoutFeedback, StyleSheet
} from 'react-native';

type Props = {
    visible: boolean;
    soundEnabled: boolean;
    onToggleSound: (val: boolean) => void;
    onClose: () => void;
};

export const SettingsModal = ({ visible, soundEnabled, onToggleSound, onClose }: Props) => (
    <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
    >
        <Pressable style={modalStyles.overlay} onPress={onClose}>
            <TouchableWithoutFeedback>
                <View style={modalStyles.content}>
                    <Text style={modalStyles.title}>알림 설정</Text>

                    <View style={modalStyles.row}>
                        <View>
                            <Text style={modalStyles.label}>앱 실행 중 알림음</Text>
                            <Text style={modalStyles.sublabel}>새 우편물 도착 시 효과음 재생</Text>
                        </View>
                        <Switch
                            value={soundEnabled}
                            onValueChange={onToggleSound}
                            trackColor={{ false: '#E2E8F0', true: '#818CF8' }}
                            thumbColor={soundEnabled ? '#4F46E5' : '#f4f3f4'}
                        />
                    </View>

                    <Pressable onPress={onClose} style={modalStyles.closeBtn}>
                        <Text style={modalStyles.closeBtnText}>닫기</Text>
                    </Pressable>
                </View>
            </TouchableWithoutFeedback>
        </Pressable>
    </Modal>
);

const modalStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    content: { backgroundColor: '#fff', width: '80%', padding: 24, borderRadius: 20 },
    title: { fontSize: 18, fontWeight: '700', marginBottom: 20, color: '#1E293B' },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    label: { fontSize: 16, fontWeight: '600', color: '#334155' },
    sublabel: { fontSize: 12, color: '#64748B' },
    closeBtn: { marginTop: 20, padding: 12, backgroundColor: '#F1F5F9', borderRadius: 12, alignItems: 'center' },
    closeBtnText: { color: '#475569', fontWeight: '700' },
});
