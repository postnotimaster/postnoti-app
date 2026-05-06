import React, { useRef } from 'react';
import { View, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppContent } from '../contexts/AppContext';
import { AdminTabBar } from '../components/admin/AdminTabBar';
import { TenantManagement } from '../components/admin/TenantManagement';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { tenantsService } from '../services/tenantsService';

export const AdminTenantsScreen = () => {
    const { officeInfo, setProfiles } = useAppContent();
    const tenantMgmtRef = useRef<any>(null);

    // 탭 버튼 클릭 시 항상 리스트로 복귀하도록 리스너 대신 useEffect로 관리 가능하지만 
    // 여기서는 단순화하여 처리

    if (!officeInfo) return null;

    return (
        <SafeAreaView style={appStyles.safeArea} edges={['top', 'left', 'right']}>
            <AppHeader title="입주사" />
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
