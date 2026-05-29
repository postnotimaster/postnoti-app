/**
 * POSTNOTI Smart Mail Management System
 * Version: 2.3.1 (Stable State-Based Rendering with Navigation Context)
 * Final fix for blank screen: Restoring NavigationContainer while keeping simple state-based logic.
 */
import React from 'react';
import { View, Text, ActivityIndicator, Alert, BackHandler } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { UIProvider, useUI } from './src/contexts/UIContext';
import { OCRProvider } from './src/contexts/OCRContext';
import { NotificationProvider, useNotifications } from './src/contexts/NotificationContext';
import { ToastProvider } from './src/contexts/ToastContext';
import { StatusBar } from 'expo-status-bar';

// Screens
import { LandingScreen } from './src/screens/LandingScreen';
import { AdminRegisterMailScreen } from './src/screens/AdminRegisterMailScreen';
import { AdminSignupScreen } from './src/screens/AdminSignupScreen';
import { AdminSettingsScreen } from './src/screens/AdminSettingsScreen';
import { AdminMenuScreen } from './src/screens/AdminMenuScreen';
import { AdminSendersScreen } from './src/screens/AdminSendersScreen';
import { AdminDashboardScreen } from './src/screens/AdminDashboardScreen';
import { AdminTenantsScreen } from './src/screens/AdminTenantsScreen';
import { AdminNoticeScreen } from './src/screens/admin/AdminNoticeScreen';
import { DeliveryScreen } from './src/screens/admin/DeliveryScreen';
import { TenantTabNavigator } from './src/navigation/TenantTabNavigator';
import { AdminNotificationSettingsScreen } from './src/screens/AdminNotificationSettingsScreen';
import { KakaoGuideOverlay } from './src/components/common/KakaoGuideOverlay';

function AppContent() {
  const { isInitializing: authLoading, officeInfo } = useAuth();
  const { mode, setMode, magicIdResolved, isInitializing: uiLoading, brandingCompany, setBrandingCompany } = useUI();
  const { expoPushToken, webPushToken } = useNotifications();

  React.useEffect(() => {
    // 관리자 자동 로그인 로직: 초기화 완료 후 officeInfo가 존재하면 즉시 대시보드로 이동
    const isSystemInitializing = authLoading || uiLoading;
    if (!isSystemInitializing && officeInfo && mode === 'landing') {
      setMode('admin_dashboard');
    }
  }, [authLoading, uiLoading, officeInfo, mode, setMode]);

  React.useEffect(() => {
    const handleBackButton = () => {
      // 1. 입주자 대시보드 화면은 자체 백핸들러가 최우선 작동하므로 이 핸들러는 무시되도록 함
      if (mode === 'tenant_dashboard') {
        return false;
      }

      // 2. 관리자/기타 모드별 백핸들링 정의
      switch (mode) {
        case 'admin_signup':
        case 'tenant_login':
          setMode('landing');
          return true;

        case 'admin_settings':
        case 'admin_notification_settings':
        case 'admin_senders':
          setMode('admin_menu');
          return true;

        case 'admin_register_mail':
          setMode('admin_dashboard');
          return true;

        case 'admin_tenants':
        case 'admin_delivery':
        case 'admin_announcements':
        case 'admin_menu':
          setMode('admin_dashboard');
          return true;

        case 'admin_dashboard':
        case 'landing':
          Alert.alert(
            '앱 종료',
            '포스트노티 앱을 종료하시겠습니까?',
            [
              { text: '취소', style: 'cancel' },
              { text: '종료', onPress: () => BackHandler.exitApp() }
            ],
            { cancelable: true }
          );
          return true;

        default:
          return false;
      }
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackButton);
    return () => backHandler.remove();
  }, [mode]);

  const isSystemInitializing = authLoading || uiLoading;

  // 1. 초기 시스템 로딩
  if (isSystemInitializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <Text style={{ fontSize: 28, fontWeight: '900', color: '#1E293B', letterSpacing: 2 }}>POSTNOTI</Text>
        <ActivityIndicator size="small" color="#4F46E5" style={{ marginTop: 20 }} />
      </View>
    );
  }

  // 2. 모드별 화면 분기 (가장 안정적인 방식)
  const renderScreen = () => {
    switch (mode) {
      case 'admin_dashboard':
      case 'admin_branch_select':
        return <AdminDashboardScreen />;
      
      case 'admin_tenants':
        return <AdminTenantsScreen />;

      case 'admin_delivery':
        return <DeliveryScreen />;

      case 'admin_announcements':
        return <AdminNoticeScreen />;

      case 'admin_menu':
        return <AdminMenuScreen />;

      case 'admin_register_mail':
        return <AdminRegisterMailScreen />;

      case 'admin_notification_settings':
        return <AdminNotificationSettingsScreen />;

      case 'admin_settings':
        return <AdminSettingsScreen />;

      case 'admin_senders':
        return <AdminSendersScreen />;

      case 'admin_signup':
        return <AdminSignupScreen />;

      case 'tenant_login':
      case 'tenant_dashboard':
        // 입주자 뷰 - 데이터 확인
        if (!magicIdResolved) {
          return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
              <ActivityIndicator color="#4F46E5" />
              <Text style={{ marginTop: 12, color: '#64748B' }}>링크 확인 중...</Text>
            </View>
          );
        }

        // 지점 정보 로딩 대기
        if (!brandingCompany || !brandingCompany.id) {
          return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
              <ActivityIndicator color="#4F46E5" />
              <Text style={{ marginTop: 12, color: '#64748B' }}>지점 정보를 불러오는 중...</Text>
            </View>
          );
        }

        return (
          <TenantTabNavigator
            route={{
              params: {
                companyId: brandingCompany?.id,
                companyName: brandingCompany?.name,
                pushToken: expoPushToken,
                webPushToken: webPushToken,
                magicProfileId: (brandingCompany as any)?.magicId,
                magicTenantId: (brandingCompany as any)?.targetTenantId || (brandingCompany as any)?.magicId,
                onBack: () => {
                  setMode('landing');
                  setBrandingCompany(null);
                }
              }
            }}
          />
        );

      case 'landing':
      default:
        return <LandingScreen />;
    }
  };

  return (
    <NavigationContainer>
      <View style={{ flex: 1 }}>
        <StatusBar style="dark" />
        {renderScreen()}
        <KakaoGuideOverlay />
      </View>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <UIProvider>
            <NotificationProvider>
              <OCRProvider>
                <AppContent />
              </OCRProvider>
            </NotificationProvider>
          </UIProvider>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
