/**
 * POSTNOTI Smart Mail Management System
 * Version: 2.1.0 (Safety Recovery & Deep Link Optimization)
 */
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Platform, Pressable } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useAppContent } from './src/contexts/AppContext';
import { ToastProvider } from './src/contexts/ToastContext';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './src/lib/supabase';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Notifications from 'expo-notifications';

// 알림 핸들러 설정
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
import { AdminRegisterMailScreen } from './src/screens/AdminRegisterMailScreen';
import { AdminSignupScreen } from './src/screens/AdminSignupScreen';
import { AdminSettingsScreen } from './src/screens/AdminSettingsScreen';
import { AdminMenuScreen } from './src/screens/AdminMenuScreen';
import { AdminSendersScreen } from './src/screens/AdminSendersScreen';
import { AdminTabNavigator } from './src/navigation/AdminTabNavigator';
import { TenantTabNavigator } from './src/navigation/TenantTabNavigator';
import { KakaoGuideOverlay } from './src/components/common/KakaoGuideOverlay';

const Stack = createNativeStackNavigator();

function AppContent() {
  const { isInitializing, mode, brandingCompany, expoPushToken, webPushToken, magicIdResolved, setMode, setBrandingCompany } = useAppContent();

  if (isInitializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 28, fontWeight: '900', color: '#1E293B', letterSpacing: 2, marginBottom: 10 }}>POSTNOTI</Text>
          <ActivityIndicator size="small" color="#4F46E5" />
          <Text style={{ marginTop: 20, color: '#94A3B8', fontSize: 13, fontWeight: '500' }}>시스템 준비 중...</Text>
        </View>
      </View>
    );
  }

  // 딥링크 설정
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
          path: 'view',
          parse: { p: (p: string) => p || '' },
        },
        AdminHome: 'admin',
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
        <Stack.Screen name="TenantDashboard" component={TenantDashboardWrapper} />
      </Stack.Navigator>

      <NavigationBridge />
      <KakaoGuideOverlay />
    </NavigationContainer>
  );
}

// 딥링크를 통해 들어온 입주자 화면을 처리하는 래퍼
function TenantDashboardWrapper(props: any) {
  const { brandingCompany, magicIdResolved, expoPushToken, webPushToken, setMode, setBrandingCompany } = useAppContent();

  // URL 파라미터에서 p(MagicId) 추출 시도
  const paramP = (props.route.params as any)?.p;
  const resolvedMagicId = paramP || (brandingCompany as any)?.magicId || '';

  // 1. 딥링크 분석이 끝날 때까지 대기
  if (!magicIdResolved) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={{ marginTop: 16, color: '#64748B' }}>보안 링크 확인 중...</Text>
      </View>
    );
  }

  // 2. 지점 정보가 없는 경우 (아직 로딩 중이거나 잘못된 링크)
  if (!brandingCompany || (!brandingCompany.id && !brandingCompany.name)) {
    if (resolvedMagicId) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={{ marginTop: 16, color: '#64748B' }}>지점 정보를 불러오고 있습니다...</Text>
        </View>
      );
    }
    
    // 정말로 정보가 없는 경우
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 25 }}>
        <Ionicons name="alert-circle-outline" size={50} color="#E11D48" />
        <Text style={{ fontSize: 18, fontWeight: '700', marginTop: 16 }}>올바르지 않은 접근</Text>
        <Text style={{ fontSize: 13, color: '#64748B', marginTop: 6, textAlign: 'center' }}>만료되었거나 잘못된 링크입니다.</Text>
        <Pressable onPress={() => setMode('landing')} style={{ marginTop: 30, padding: 12, backgroundColor: '#4F46E5', borderRadius: 10, width: '100%', alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>홈으로 이동</Text>
        </Pressable>
      </View>
    );
  }

  // 3. 정상적인 데이터가 있으면 탭 내비게이터 렌더링
  return (
    <TenantTabNavigator
      route={{
        params: {
          companyId: brandingCompany.id,
          companyName: brandingCompany.name,
          pushToken: expoPushToken,
          webPushToken: webPushToken,
          magicProfileId: resolvedMagicId,
          magicTenantId: resolvedMagicId,
          onBack: () => {
            setMode('landing');
            setBrandingCompany(null);
            props.navigation.navigate('Landing');
          }
        }
      }}
    />
  );
}

// 컨텍스트 상태와 내비게이션 동기화 브릿지
import { useNavigation } from '@react-navigation/native';
function NavigationBridge() {
  const { mode, brandingCompany } = useAppContent();
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (mode === 'tenant_login' && brandingCompany) {
      const state = navigation.getState();
      const currentRoute = state?.routes[state?.index]?.name;
      if (currentRoute !== 'TenantDashboard') {
        navigation.reset({
          index: 0,
          routes: [{ name: 'TenantDashboard', params: { p: (brandingCompany as any).magicId } }],
        });
      }
    } else if (mode === 'landing') {
      const state = navigation.getState();
      const currentRoute = state?.routes[state?.index]?.name;
      if (currentRoute !== 'Landing') {
        navigation.navigate('Landing');
      }
    }
  }, [mode, brandingCompany, navigation]);

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </ToastProvider>
    </SafeAreaProvider>
  );
}
