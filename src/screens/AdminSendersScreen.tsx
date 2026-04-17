import React from 'react';
import { SafeAreaView, View } from 'react-native';
import { useAppContent } from '../contexts/AppContext';
import { SenderManagement } from '../components/admin/SenderManagement';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { masterSendersService } from '../services/masterSendersService';
import { useNavigation } from '@react-navigation/native';

export const AdminSendersScreen = () => {
    const navigation = useNavigation<any>();
    const { setMasterSenders } = useAppContent();

    const handleBack = async () => {
        const senders = await masterSendersService.getAllSenders();
        setMasterSenders(senders.map(s => s.name));
        navigation.goBack();
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
