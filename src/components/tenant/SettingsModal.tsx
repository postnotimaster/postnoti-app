import React from 'react';
import {
    View, Text, Pressable, Modal, Switch,
    TouchableWithoutFeedback, StyleSheet
} from 'react-native';

type Props = {
    visible: boolean;
    soundEnabled: boolean;
    permissionStatus: NotificationPermission | 'default';
    onToggleSound: (val: boolean) => void;
    onRequestPermission: () => void;
    onClose: () => void;
};

export const SettingsModal = ({ 
    visible, 
    soundEnabled, 
    permissionStatus, 
    onToggleSound, 
    onRequestPermission,
    onClose 
}: Props) => (
    <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
    >
        <Pressable style={modalStyles.overlay} onPress={onClose}>
            <TouchableWithoutFeedback>
                <View style={modalStyles.content}>
                    <Text style={modalStyles.title}>설정</Text>

                    {/* 알림 권한 상태 표시 섹션 */}
                    <View style={[modalStyles.row, { marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                        <View style={{ flex: 1 }}>
                            <Text style={modalStyles.label}>알림 수신 상태</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                                <View style={{ 
                                    width: 8, 
                                    height: 8, 
                                    borderRadius: 4, 
                                    backgroundColor: permissionStatus === 'granted' ? '#10B981' : (permissionStatus === 'denied' ? '#EF4444' : '#F59E0B'),
                                    marginRight: 6 
                                }} />
                                <Text style={[modalStyles.sublabel, { color: permissionStatus === 'granted' ? '#059669' : (permissionStatus === 'denied' ? '#DC2626' : '#D97706'), fontWeight: '700' }]}>
                                    {permissionStatus === 'granted' ? '허용됨 (정상 수신 가능)' : (permissionStatus === 'denied' ? '차단됨 (설정 필요)' : '설정 대기 중')}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={permissionStatus === 'granted'}
                            onValueChange={(val) => {
                                if (val) {
                                    if (permissionStatus === 'denied') {
                                        alert('알림이 차단되어 있습니다. 휴대폰의 [설정] 앱을 열고, 설치된 이 앱(또는 브라우저)의 알림 권한을 직접 허용으로 변경해 주세요.');
                                    } else {
                                        onRequestPermission();
                                    }
                                } else {
                                    alert('알림을 끄려면 휴대폰의 [설정] 앱에서 이 앱의 알림 권한을 차단으로 변경해 주세요.');
                                }
                            }}
                            trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                            thumbColor={permissionStatus === 'granted' ? '#fff' : '#f4f3f4'}
                        />
                    </View>

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
                        <Text style={modalStyles.closeBtnText}>확인</Text>
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
