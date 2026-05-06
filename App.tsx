/**
 * POSTNOTI Smart Mail Management System
 * Version: 2.3.1 (Stable State-Based Rendering with Navigation Context)
 * Final fix for blank screen: Restoring NavigationContainer while keeping simple state-based logic.
 */
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
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
  const { isInitializing, brandingCompany, setBrandingCompany } = useAuth();
  const { mode, setMode, magicIdResolved } = useUI();
  const { expoPushToken, webPushToken } = useNotifications();

  // 1. 초기 시스템 로딩
  if (isInitializing) {
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
                companyId: brandingCompany.id,
                companyName: brandingCompany.name,
                pushToken: expoPushToken,
                webPushToken: webPushToken,
                magicProfileId: (brandingCompany as any).magicId,
                magicTenantId: (brandingCompany as any).magicId,
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
          <UIProviderWrapper>
            <NotificationProvider>
              <OCRProvider>
                <AppContent />
              </OCRProvider>
            </NotificationProvider>
          </UIProviderWrapper>
        </AuthProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}

// Wrapper to pass setBrandingCompany to UIProvider
const UIProviderWrapper = ({ children }: { children: React.ReactNode }) => {
  const { setBrandingCompany } = useAuth();
  return <UIProvider setBrandingCompany={setBrandingCompany}>{children}</UIProvider>;
};
