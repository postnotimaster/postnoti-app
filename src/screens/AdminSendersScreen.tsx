import React from 'react';
import { SafeAreaView, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { SenderManagement } from '../components/admin/SenderManagement';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { masterSendersService } from '../services/masterSendersService';

export const AdminSendersScreen = () => {
    const { setProfiles } = useAuth();
    const { setMode } = useUI();

    const handleBack = async () => {
        const senders = await masterSendersService.getAllSenders();
        setMasterSenders(senders.map(s => s.name));
        setMode('admin_dashboard');
    };

    return (
        <SafeAreaView style={appStyles.safeArea}>
            <AppHeader title="발신처 키워드 관리" onBack={handleBack} />
            <View style={{ flex: 1, backgroundColor: '#fff' }}>
                <SenderManagement onClose={handleBack} />
            </View>
        </SafeAreaView>
    );
};
