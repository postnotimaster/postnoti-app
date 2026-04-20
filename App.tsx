/**
 * POSTNOTI Smart Mail Management System
 * Version: 2.0.0 (Unified Account Migration & 1:1 Office Model)
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Platform, Pressable } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppProvider, useAppContent } from './src/contexts/AppContext';
import { ToastProvider } from './src/contexts/ToastContext';
import { StatusBar } from 'expo-status-bar';

// Screens
import { LandingScreen } from './src/screens/LandingScreen';
import { AdminDashboardScreen } from './src/screens/AdminDashboardScreen';
import { AdminRegisterMailScreen } from './src/screens/AdminRegisterMailScreen';
import { AdminSignupScreen } from './src/screens/AdminSignupScreen';
import { AdminSettingsScreen } from './src/screens/AdminSettingsScreen';
import { AdminMenuScreen } from './src/screens/AdminMenuScreen';
import { AdminSendersScreen } from './src/screens/AdminSendersScreen';
import { AdminTabNavigator } from './src/navigation/AdminTabNavigator';
import { TenantTabNavigator } from './src/navigation/TenantTabNavigator';
import { TenantDashboard } from './src/components/tenant/TenantDashboard';
import { KakaoGuideOverlay } from './src/components/common/KakaoGuideOverlay';
// Note: TenantDashboard is still in components, can be moved later. 
// We will wrap it in a Screen component if needed or use directly if it accepts navigation props, 
// but existing TenantDashboard uses 'onBack'. We should adapt it.

const Stack = createNativeStackNavigator();

function AppContent() {
  const { isInitializing, mode, brandingCompany, expoPushToken, webPushToken, setMode, setBrandingCompany } = useAppContent();
  const [initialRoute, setInitialRoute] = useState<string | null>(null);

  // Sync 'mode' from Context to Navigation (for Deep Linking support)
  // When 'mode' changes in Context (e.g. from Deep Link), we need to navigate.
  // This is a bridge between the old 'mode' logic and new Navigation.

  // Actually, standard NavigationContainer 'linking' prop is better, 
  // but to keep logic gathered in AppContext working (which sets 'mode'), we use an effect.

  // NOTE: This creates a two-way binding or potential loop if not careful.
  // Ideally, AppContext shouldn't setMode anymore, but for safety in this refactor, we bridge it.

  useEffect(() => {
    if (isInitializing) return;

    // Initial Route determination is actually done via NavigationContainer logic usually, 
    // but here we follow the context state which might have been set by DeepLink.
  }, [isInitializing]);

  if (isInitializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#1E293B', letterSpacing: 2, marginBottom: 10 }}>POSTNOTI</Text>
          <ActivityIndicator size="small" color="#4F46E5" />
          <Text style={{ marginTop: 20, color: '#94A3B8', fontSize: 13, fontWeight: '500' }}>스마트 우편 관리 시스템 준비 중...</Text>
        </View>
      </View>
    );
  }

  // --- React Navigation 공식 딥링크 설정 (웹/모바일 호환) ---
  const linking = {
    prefixes: [
      'postnoti://',
      'https://postnoti-app-two.vercel.app',
      Platform.OS === 'web' ? window.location.origin : ''
    ].filter(Boolean),
    config: {
      screens: {
        Landing: 'Landing',
        TenantDashboard: 'branch/:slug/view',
        AdminDashboard: 'admin',
        AdminRegisterMail: 'register',
      },
    },
  };

  const initialRouteName = (mode === 'tenant_login' && brandingCompany) ? 'TenantDashboard' : 'Landing';

  return (
    <NavigationContainer linking={linking}>
      <StatusBar style="dark" />
      <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="AdminHome" component={AdminTabNavigator} />
        <Stack.Screen name="AdminRegisterMail" component={AdminRegisterMailScreen} />
        <Stack.Screen name="AdminSignup" component={AdminSignupScreen} />
        <Stack.Screen name="AdminSettings" component={AdminSettingsScreen} />
        <Stack.Screen name="AdminMenu" component={AdminMenuScreen} />
        <Stack.Screen name="AdminSenders" component={AdminSendersScreen} />

        {/* 입주자 다이렉트 뷰 */}
        <Stack.Screen
          name="TenantDashboard"
          component={TenantDashboardWrapper}
        />
      </Stack.Navigator>

      <NavigationBridge />
      <KakaoGuideOverlay />
    </NavigationContainer>
  );
}

/**
 * TenantDashboard 전용 래퍼 (정적 컴포넌트로 선언하여 리마운트 방지)
 */
function TenantDashboardWrapper(props: any) {
  const { brandingCompany, expoPushToken, webPushToken, setMode, setBrandingCompany } = useAppContent();
  const [showRetry, setShowRetry] = useState(false);

  // 5초 이상 로딩되면 재시도 버튼 노출
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!brandingCompany?.id) setShowRetry(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [brandingCompany?.id]);

  const company = brandingCompany || (props.route.params as any);

  if (!company?.id) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 20 }}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={{ marginTop: 16, color: '#1E293B', fontSize: 16, fontWeight: '700' }}>우편함데이터가져오는 중...</Text>
        <Text style={{ marginTop: 8, color: '#94A3B8', fontSize: 13, textAlign: 'center' }}>
          지점 정보를 서버에서 확인하고 있습니다.{"\n"}잠시만 기다려주세요.
        </Text>

        {showRetry && (
          <View style={{ marginTop: 30, alignItems: 'center' }}>
            <Text style={{ color: '#EF4444', fontSize: 13, marginBottom: 12 }}>연결이 원활하지 않나요?</Text>
            <Pressable
              onPress={() => {
                setShowRetry(false);
                setMode('landing');
                setBrandingCompany(null);
                props.navigation.replace('Landing');
              }}
              style={{ paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#F1F5F9', borderRadius: 10 }}
            >
              <Text style={{ color: '#475569', fontWeight: '700' }}>처음으로 돌아가기</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  return (
    <TenantDashboard
      {...props}
      companyId={company.id}
      companyName={company.name}
      pushToken={expoPushToken}
      webPushToken={webPushToken}
      magicProfileId={company.magicId}
      magicTenantId={company.magicId}
      onBack={() => {
        setMode('landing');
        setBrandingCompany(null);
        props.navigation.navigate('Landing');
      }}
    />
  );
}

// Internal component to listen to Context 'mode' changes and trigger Navigation
import { useNavigation } from '@react-navigation/native';

function NavigationBridge() {
  const { mode, brandingCompany } = useAppContent();
  const navigation = useNavigation<any>();

  useEffect(() => {
    // If mode changes to 'tenant_login' and we have branding, navigate to TenantDashboard
    if (mode === 'tenant_login' && brandingCompany) {
      navigation.reset({
        index: 0,
        routes: [{ name: 'TenantDashboard' }],
      });
    }
  }, [mode, brandingCompany, navigation]);

  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <AppContent />
      </AppProvider>
    </ToastProvider>
  );
}
