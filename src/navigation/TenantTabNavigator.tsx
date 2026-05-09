import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TenantDashboard } from '../components/tenant/TenantDashboard';
import { NoticeListScreen } from '../screens/tenant/NoticeListScreen';

const Tab = createBottomTabNavigator();

export const TenantTabNavigator = ({ route }: any) => {
    const { companyId, companyName, pushToken, webPushToken, magicProfileId, magicTenantId, onBack } = route.params;

    return (
        <TenantDashboard
            companyId={companyId}
            companyName={companyName}
            pushToken={pushToken}
            webPushToken={webPushToken}
            magicProfileId={magicProfileId}
            magicTenantId={magicTenantId}
            onBack={onBack}
        />
    );
};
