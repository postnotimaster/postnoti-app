import React, { useRef, useEffect } from 'react';
import { View, Switch, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { AdminTabBar } from '../components/admin/AdminTabBar';
import { TenantManagement } from '../components/admin/TenantManagement';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { tenantsService } from '../services/tenantsService';

export const AdminTenantsScreen = () => {
    const { officeInfo, setProfiles } = useAuth();
    const tenantMgmtRef = useRef<any>(null);

    useEffect(() => {
        const onBackPress = () => {
            if (tenantMgmtRef.current && tenantMgmtRef.current.handleBack()) {
                return true; // TenantManagement에서 편집 모드 취소를 처리함
            }
            return false; // 전역 백핸들러로 제어권 넘김
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => backHandler.remove();
    }, []);

    if (!officeInfo) return null;

    return (
        <SafeAreaView style={appStyles.safeArea} edges={['top', 'left', 'right']}>
            <AppHeader title="입주사 관리" />
            <View style={{ flex: 1, backgroundColor: '#fff' }}>
                <TenantManagement
                    ref={tenantMgmtRef}
                    companyId={officeInfo.id}
                    onComplete={async () => {
                        const p = await tenantsService.getTenantsByCompany(officeInfo.id);
                        setProfiles(p);
                    }}
                    onCancel={() => {
                        // In Tab context, cancel might just refresh or do nothing
                        // But we want to stay on the list view
                    }}
                />
            </View>
            <AdminTabBar />
        </SafeAreaView>
    );
};
