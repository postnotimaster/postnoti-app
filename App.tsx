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
  const { brandingCompany, setBrandingCompany, expoPushToken, webPushToken, setMode } = useAppContent();
  const [showRetry, setShowRetry] = useState(false);
  const [localBranding, setLocalBranding] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const slugFromParam = (props.route.params as any)?.slug;
  const magicIdFromParam = (props.route.params as any)?.p;

  // 10초 이상 로딩되면 재시도 버튼 강제 노출
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!brandingCompany?.id && !localBranding?.id) {
        setShowRetry(true);
        if (!fetchError) setFetchError('로딩 시간이 10초를 초과했습니다. 네트워크 상태를 확인해 주세요.');
      }
    }, 10000);
    return () => clearTimeout(timer);
  }, [brandingCompany?.id, localBranding?.id]);

  // [긴급 복구] AppContext에서 지점 정보를 못 가져올 경우 직접 시도
  useEffect(() => {
    const directFetch = async () => {
      // 이미 정보가 있으면 스킵
      if (brandingCompany?.id || localBranding?.id) return;

      if (!slugFromParam) {
        console.warn('[TenantDashboardWrapper] No slug found in params');
        return;
      }

      console.log(`[TenantDashboardWrapper] Direct fetch attempt for: ${slugFromParam}`);
      setLoading(true);
      setFetchError(null);

      try {
        // [DEBUG] Supabase 클라이언트 상태 확인
        if (!supabase) {
          setFetchError('Supabase 클라이언트가 초기화되지 않았습니다.');
          return;
        }

        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .ilike('slug', slugFromParam.trim())
          .single();

        if (error) {
          console.error('[TenantDashboardWrapper] DB Query Error:', error);
          setFetchError(`서버 오류: ${error.message} (${error.code || 'CODE_NONE'})`);
          return;
        }

        if (data) {
          console.log(`[TenantDashboardWrapper] Found: ${data.name} (ID: ${data.id})`);
          setLocalBranding(data);
          // 전역 상태에 반영 시도 (동기화)
          setBrandingCompany({ ...data, magicId: magicIdFromParam } as any);
        } else {
          setFetchError('해당 주소(Slug)로 등록된 지점을 찾을 수 없습니다.');
        }
      } catch (e: any) {
        console.error('[TenantDashboardWrapper] Exception:', e);
        setFetchError(`예기치 못한 에러: ${e.message || String(e)}`);
      } finally {
        setLoading(false);
      }
    };
    directFetch();
  }, [slugFromParam]);

  const company = brandingCompany || localBranding;

  if (!company?.id) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 25 }}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={{ marginTop: 24, color: '#1E293B', fontSize: 18, fontWeight: '800' }}>우편함데이터가져오는 중...</Text>
        <Text style={{ marginTop: 10, color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 20 }}>
          지점 정보를 확인하고 있습니다.{"\n"}잠시만 기다려주세요.
        </Text>

        {/* [중요] 문제 해결을 위한 시스템 로그 대시보드 */}
        <View style={{ marginTop: 40, padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16, width: '100%', borderWidth: 1, borderColor: '#E2E8F0' }}>
          <Text style={{ fontSize: 12, color: '#475569', fontWeight: '800', marginBottom: 12 }}>🔍 시스템 진단 정보</Text>

          <View style={{ gap: 6 }}>
            <Text style={{ fontSize: 12, color: '#64748B' }}>• 대상 ID (Slug): <Text style={{ color: '#0F172A', fontWeight: '600' }}>{slugFromParam || '(없음)'}</Text></Text>
            <Text style={{ fontSize: 12, color: '#64748B' }}>• 매직 링크 ID: <Text style={{ color: '#0F172A', fontWeight: '600' }}>{magicIdFromParam || '(없음)'}</Text></Text>
            <Text style={{ fontSize: 12, color: '#64748B' }}>• 데이터 상태: <Text style={{ color: loading ? '#6366F1' : '#10B981', fontWeight: '600' }}>{loading ? '조회 중...' : (company?.id ? '성공' : '대기/오류')}</Text></Text>

            {fetchError && (
              <View style={{ marginTop: 10, padding: 10, backgroundColor: '#FEF2F2', borderRadius: 8 }}>
                <Text style={{ fontSize: 12, color: '#EF4444', fontWeight: '700' }}>⚠️ 발견된 문제:</Text>
                <Text style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>{fetchError}</Text>
              </View>
            )}
          </View>
        </View>

        {showRetry && (
          <View style={{ marginTop: 40, alignItems: 'center', width: '100%' }}>
            <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 16 }}>연결이 계속되지 않나요?</Text>
            <Pressable
              onPress={() => {
                setShowRetry(false);
                setMode('landing');
                setBrandingCompany(null);
                props.navigation.replace('Landing');
              }}
              style={{ width: '100%', paddingVertical: 14, backgroundColor: '#F1F5F9', borderRadius: 12, alignItems: 'center' }}
            >
              <Text style={{ color: '#1E293B', fontWeight: '700' }}>메인 화면으로 돌아가기</Text>
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
      magicProfileId={company.magicId || magicIdFromParam}
      magicTenantId={company.magicId || magicIdFromParam}
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
      console.log(`[NavigationBridge] Resetting to TenantDashboard for: ${brandingCompany.slug} (MagicId: ${brandingCompany.magicId})`);
      navigation.reset({
        index: 0,
        routes: [{
          name: 'TenantDashboard',
          params: {
            slug: brandingCompany.slug,
            p: (brandingCompany as any).magicId // [중요] 매직 링크 ID 유지를 위해 파라미터 전달
          }
        }],
      });
    } else if (mode === 'landing') {
      // If we are forced to landing, ensure we actually navigate there
      const state = navigation.getState();
      const currentRoute = state?.routes[state?.index]?.name;
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
