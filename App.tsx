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

  // [3차 보강] URL 전체가 p로 들어오는 케이스 및 인코딩 케이스 방어
  const paramP = React.useMemo(() => {
    if (!rawParamP) return '';
    if (!rawParamP.includes('://') && !rawParamP.includes('%3F')) return rawParamP;

    // A) 정규식 시도
    const decoded = decodeURIComponent(rawParamP);
    const match = decoded.match(/(?:\?|&|%3F|%26)p=([^&/?#]+)/i);
    if (match) return match[1];

    // B) Brute-force Split (최후의 수단: 무조건 p= 뒤를 뽑음)
    if (decoded.includes('p=')) {
      return decoded.split('p=')[1].split('&')[0].split('/')[0];
    }

    return rawParamP;
  }, [rawParamP]);

  const company = brandingCompany;
  const resolvedMagicId = paramP || (company as any)?.magicId || '';

  // [중요] 아직 딥링크/id 초기화 전이면 대기
  if (!magicIdResolved) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={{ marginTop: 16, color: '#64748B', fontSize: 14 }}>매직링크 보호 시스템 가동 중...</Text>
      </View>
    );
  }

  // 지점 정보를 찾지 못한 경우 (대기 시간이 길어지거나 진짜 없는 경우)
  if (!company || (!company.id && !company.name)) {
    const handleReload = async () => {
      if (Platform.OS === 'web') {
        try {
          // 캐시 강제 삭제 시도 (PWA/ServiceWorker 대응)
          if ('caches' in window) {
            const cacheNames = await caches.keys();
            await Promise.all(cacheNames.map(name => caches.delete(name)));
          }
          window.location.href = window.location.href.split('#')[0]; // fragment 제거 후 이동
          window.location.reload();
        } catch (e) {
          window.location.reload();
        }
      } else {
        setMode('landing');
        props.navigation.replace('Landing');
      }
    };

    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 30 }}>
        <Ionicons name="alert-circle-outline" size={60} color="#E11D48" />
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#1E293B', marginTop: 16, textAlign: 'center' }}>
          지점 정보를 찾을 수 없습니다.
        </Text>
        <Text style={{ fontSize: 14, color: '#64748B', marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
          URL이 잘못되었거나 만료된 링크일 수 있습니다. 관리자에게 문의해 주세요.
        </Text>

        <View style={{ marginTop: 30, padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12, width: '100%', borderWidth: 1, borderColor: '#E2E8F0' }}>
          <Text style={{ fontSize: 11, color: '#475569', fontWeight: '800', marginBottom: 8, opacity: 0.7 }}>🔍 시스템 진단 정보 (v23:45)</Text>
          <Text style={{ fontSize: 11, color: '#64748B' }}>• MagicID: <Text style={{ color: '#0F172A', fontWeight: 'bold' }}>{resolvedMagicId || '(없음)'}</Text></Text>
          <Text style={{ fontSize: 11, color: '#64748B' }}>• Context: <Text style={{ color: brandingCompany ? '#10B981' : '#EF4444', fontWeight: 'bold' }}>{brandingCompany ? 'Resolved' : 'Missing'}</Text></Text>
          <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4 }}>• Raw: <Text style={{ color: '#94A3B8', fontSize: 9 }}>{rawParamP?.substring(0, 50)}...</Text></Text>
          <Text style={{ fontSize: 11, color: '#64748B' }}>• Env: <Text style={{ color: '#94A3B8', fontSize: 9 }}>{Platform.OS} / {typeof window !== 'undefined' ? 'Web' : 'Native'}</Text></Text>
        </View>

        <Pressable
          onPress={handleReload}
          style={{ marginTop: 20, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#4F46E5', borderRadius: 10, width: '100%', alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>강력새로고침 (캐시삭제)</Text>
        </Pressable>

        <Pressable
          onPress={() => { setMode('landing'); setBrandingCompany(null); props.navigation.replace('Landing'); }}
          style={{ marginTop: 12, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: '#F1F5F9', borderRadius: 10, width: '100%', alignItems: 'center' }}
        >
          <Text style={{ color: '#475569', fontWeight: '700' }}>홈으로 이동</Text>
        </Pressable>
      </View>
    );
  }

  console.log(`[TenantDashboardWrapper] 렌더링 시작. 지점: ${company.name}, 매직ID: ${resolvedMagicId}`);

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
