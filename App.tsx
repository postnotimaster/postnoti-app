/**
 * POSTNOTI Smart Mail Management System
 * Version: 2.2.0 (Stable Navigation & Crash Prevention)
 */
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ActivityIndicator, Platform, Pressable, Alert } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useAppContent } from './src/contexts/AppContext';
import { ToastProvider } from './src/contexts/ToastContext';
import { StatusBar } from 'expo-status-bar';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Notifications from 'expo-notifications';

// 알림 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
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
  const { isInitializing, mode, brandingCompany, magicIdResolved } = useAppContent();

  // 초기 로딩 화면 (여기서 멈추면 AppContext.init 문제)
  if (isInitializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <Text style={{ fontSize: 24, fontWeight: '900', color: '#1E293B', marginBottom: 10 }}>POSTNOTI</Text>
        <ActivityIndicator size="small" color="#4F46E5" />
      </View>
    );
  }

  // 딥링크 설정
  const linking = {
    prefixes: ['postnoti://', 'https://postnoti-app-two.vercel.app'],
    config: {
      screens: {
        Landing: 'Landing',
        TenantDashboard: 'view',
        AdminHome: 'admin',
      },
    },
  };

  // 모드에 따른 초기 화면 결정
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
        <Stack.Screen name="TenantDashboard" component={TenantDashboardWrapper} />
      </Stack.Navigator>

      <NavigationBridge />
      <KakaoGuideOverlay />
    </NavigationContainer>
  );
}

// 입주자 화면 래퍼 (데이터 정합성 보장)
function TenantDashboardWrapper({ navigation, route }: any) {
  const { brandingCompany, magicIdResolved, expoPushToken, webPushToken, setMode, setBrandingCompany } = useAppContent();

  // URL 파라미터에서 MagicId 추출
  const paramP = route.params?.p;
  const resolvedMagicId = paramP || (brandingCompany as any)?.magicId;

  // 상태 체크 로그 (백지 현상 추적용)
  console.log('[TenantDashboardWrapper] Render', { resolvedMagicId, magicIdResolved, hasCompany: !!brandingCompany });

  // 1. 딥링크 분석 대기
  if (!magicIdResolved) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator color="#4F46E5" />
        <Text style={{ marginTop: 10, color: '#64748B' }}>보안 링크 확인 중...</Text>
      </View>
    );
  }

  // 2. 지점 정보 대기 (Fast-Track 대응)
  if (!brandingCompany || !brandingCompany.id) {
    if (resolvedMagicId) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
          <ActivityIndicator color="#4F46E5" />
          <Text style={{ marginTop: 10, color: '#64748B' }}>지점 정보를 로드하고 있습니다...</Text>
        </View>
      );
    }
    
    // 정보 없음 에러
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 }}>
        <Ionicons name="alert-circle" size={40} color="#EF4444" />
        <Text style={{ fontSize: 16, fontWeight: '700', marginTop: 10 }}>잘못된 링크입니다.</Text>
        <Pressable onPress={() => setMode('landing')} style={{ marginTop: 20, padding: 10, backgroundColor: '#4F46E5', borderRadius: 8 }}>
          <Text style={{ color: '#fff' }}>홈으로 이동</Text>
        </Pressable>
      </View>
    );
  }

  // 3. 정상 렌더링 (TenantTabNavigator에 props 직접 전달)
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
            navigation.navigate('Landing');
          }
        }
      }}
    />
  );
}

// 컨텍스트 상태 기반 내비게이션 브릿지
import { useNavigation } from '@react-navigation/native';
function NavigationBridge() {
  const { mode, brandingCompany } = useAppContent();
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (!navigation) return;
    
    const state = navigation.getState();
    const currentRoute = state?.routes[state?.index]?.name;

    if (mode === 'tenant_login' && brandingCompany && currentRoute !== 'TenantDashboard') {
      console.log('[NavigationBridge] Resetting to TenantDashboard');
      navigation.reset({
        index: 0,
        routes: [{ name: 'TenantDashboard', params: { p: (brandingCompany as any).magicId } }],
      });
    } else if (mode === 'landing' && currentRoute !== 'Landing') {
      navigation.navigate('Landing');
    }
  }, [mode, brandingCompany]);

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
