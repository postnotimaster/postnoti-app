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
import { supabase } from './src/lib/supabase';
import Ionicons from '@expo/vector-icons/Ionicons';

import * as Notifications from 'expo-notifications';

// 알림이 포어그라운드(앱이 켜져 있을 때)에서도 상단에 뜨도록 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
import { tenantsService } from './src/services/tenantsService';
import { profilesService } from './src/services/profilesService'; // 추가
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
        TenantDashboard: {
          // 1) /view?p=ID (Slug-less / New)
          // 2) /branch/:slug/view?p=ID (Legacy)
          path: 'view',
          parse: {
            p: (p: string) => p || '',
          },
        },
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
  const { brandingCompany, setBrandingCompany, setMode, expoPushToken, webPushToken, magicIdResolved } = useAppContent();
  const [fetchError, setFetchError] = useState<string | null>(null);

  const slugFromParam = (props.route.params as any)?.slug;
  const rawParamP = (props.route.params as any)?.p;

  // [최종 병기] 모든 레벨에서의 ID 추출 시도 (v24:05 Final)
  const paramP = React.useMemo(() => {
    let bestId = '';

    // 1. 브라우저 주소창 직접 분석 (가장 확실함)
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const href = window.location.href;
      const decoded = decodeURIComponent(href);
      const uuidMatch = decoded.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (uuidMatch) bestId = uuidMatch[0];
    }

    // 2. React Navigation에서 준 값 (보조)
    if (!bestId && rawParamP) {
      const decodedRaw = decodeURIComponent(rawParamP);
      const uuidMatchRaw = decodedRaw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
      if (uuidMatchRaw) bestId = uuidMatchRaw[0];
      else if (rawParamP.length === 36) bestId = rawParamP;
    }

    return bestId;
  }, [rawParamP]);

  const company = brandingCompany;
  const resolvedMagicId = paramP || (company as any)?.magicId || '';

  // [중요] 아직 딥링크/id 초기화 전이면 대기
  if (!magicIdResolved) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={{ marginTop: 16, color: '#64748B', fontSize: 14 }}>보안 링크 확인 중...</Text>
      </View>
    );
  }

  // 지점 정보를 찾지 못한 경우 (대기 시간이 길어지거나 진짜 없는 경우)
  if (!company || (!company.id && !company.name)) {
    const handleReload = () => {
      if (Platform.OS === 'web') {
        window.location.reload();
      } else {
        setMode('landing');
        props.navigation.replace('Landing');
      }
    };

    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 25 }}>
        <Ionicons name="alert-circle-outline" size={50} color="#E11D48" />
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1E293B', marginTop: 16 }}>지점 정보 불일치</Text>
        <Text style={{ fontSize: 13, color: '#64748B', marginTop: 6, textAlign: 'center' }}>만료되었거나 잘못된 링크입니다. 관리자에게 문의해 주세요.</Text>

        <Pressable
          onPress={handleReload}
          style={{ marginTop: 30, paddingVertical: 12, width: '100%', backgroundColor: '#4F46E5', borderRadius: 10, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>새로고침</Text>
        </Pressable>

        <Text onPress={() => setMode('landing')} style={{ marginTop: 20, color: '#94A3B8', fontSize: 11, textDecorationLine: 'underline' }}>첫 화면으로</Text>
      </View>
    );
  }

  return (
    <TenantDashboard
      companyId={company.id}
      companyName={company.name}
      pushToken={expoPushToken}
      webPushToken={webPushToken}
      magicProfileId={resolvedMagicId}
      magicTenantId={resolvedMagicId}
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
    // [중요] 무한 리셋 루프 방지를 위해 현재 내비게이션 상태 확인
    const state = navigation.getState();
    const currentRoute = state?.routes[state?.index]?.name;
    const currentParams = state?.routes[state?.index]?.params as any;

    if (mode === 'tenant_login' && brandingCompany) {
      // 이미 해당 화면에 있고 파라미터가 같다면 중복 리셋 방지
      const targetSlug = brandingCompany.slug;
      const targetP = (brandingCompany as any).magicId;

      if (currentRoute === 'TenantDashboard' && currentParams?.p === targetP) {
        // 이미 렌더링 중이므로 루프 차단
        return;
      }

      console.log(`[NavigationBridge] Navigating to TenantDashboard. Slug: ${targetSlug}, MagicId: ${targetP}`);
      navigation.reset({
        index: 0,
        routes: [{
          name: 'TenantDashboard',
          params: {
            slug: targetSlug,
            p: targetP
          }
        }],
      });
    } else if (mode === 'landing') {
      if (currentRoute !== 'Landing') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'Landing' }],
        });
      }
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
