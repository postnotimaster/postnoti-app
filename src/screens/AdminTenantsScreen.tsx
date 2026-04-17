import React, { useRef } from 'react';
import { View, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useAppContent } from '../contexts/AppContext';
import { TenantManagement } from '../components/admin/TenantManagement';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { tenantsService } from '../services/tenantsService';

export const AdminTenantsScreen = () => {
    const navigation = useNavigation<any>();
    const { officeInfo, setProfiles } = useAppContent();
    const tenantMgmtRef = useRef<any>(null);

    // 탭 버튼 클릭 시 항상 리스트로 복귀하도록 리스너 추가
    React.useEffect(() => {
        const unsubscribe = navigation.addListener('tabPress', (e: any) => {
            // 이미 이 화면에 있는 상태에서 탭을 누르면 리스트로 강제 복구
            tenantMgmtRef.current?.resetToListView?.();
        });

        return unsubscribe;
    }, [navigation]);

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
        </SafeAreaView>
    );
};
