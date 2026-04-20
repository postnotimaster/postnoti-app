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

  // 5초 이상 로딩되면 재시도 버튼 노출
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!brandingCompany?.id && !localBranding?.id) setShowRetry(true);
    }, 5000);
    return () => clearTimeout(timer);
  }, [brandingCompany?.id, localBranding?.id]);

  // [긴급 복구] AppContext에서 지점 정보를 못 가져올 경우 직접 시도
  useEffect(() => {
    const directFetch = async () => {
      if (brandingCompany?.id) return;

      if (!slugFromParam) {
        setFetchError('Slug값이 URL에 전달되지 않았습니다.');
        return;
      }

      console.log(`[TenantDashboardWrapper] Emergency direct fetch for slug: ${slugFromParam}`);
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('companies')
          .select('*')
          .ilike('slug', slugFromParam.trim())
          .single();

        if (error) {
          console.error('[TenantDashboardWrapper] Query Error:', error);
          setFetchError(`데이터베이스 오류: ${error.message}`);
          return;
        }

        if (data) {
          console.log(`[TenantDashboardWrapper] Found via direct fetch: ${data.name}`);
          setLocalBranding(data);
          // 전역 상태도 업데이트 시도
          setBrandingCompany({ ...data, magicId: magicIdFromParam } as any);
        } else {
          setFetchError('존재하지 않는 지점 주소(Slug)입니다.');
        }
      } catch (e: any) {
        console.error('[TenantDashboardWrapper] Direct fetch error:', e);
        setFetchError(`네트워크/예외 오류: ${e.message}`);
      } finally {
        setLoading(false);
      }
    };
    directFetch();
  }, [slugFromParam]);

  const company = brandingCompany || localBranding || (props.route.params as any);

  if (!company?.id) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff', padding: 20 }}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={{ marginTop: 16, color: '#1E293B', fontSize: 16, fontWeight: '700' }}>우편함데이터가져오는 중...</Text>
        <Text style={{ marginTop: 8, color: '#94A3B8', fontSize: 13, textAlign: 'center' }}>
          지점 정보를 서버에서 확인하고 있습니다.{"\n"}잠시만 기다려주세요.
        </Text>

        {/* 디버그 정보 표시 (해결을 위해) */}
        <View style={{ marginTop: 20, padding: 10, backgroundColor: '#f8fafc', borderRadius: 8, width: '100%' }}>
          <Text style={{ fontSize: 10, color: '#64748b' }}>[시스템 분석 정보]</Text>
          <Text style={{ fontSize: 11, color: '#475569' }}>- 요청 Slug: {slugFromParam || '없음'}</Text>
          <Text style={{ fontSize: 11, color: '#475569' }}>- Magic ID: {magicIdFromParam || '없음'}</Text>
          <Text style={{ fontSize: 11, color: fetchError ? '#ef4444' : '#475569', fontWeight: fetchError ? 'bold' : 'normal' }}>
            - 오류 상태: {fetchError || '오류 없음 (로딩 중이거나 데이터 확인 중)'}
          </Text>
        </View>

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
              <Text style={{ color: '#475569', fontWeight: '700' }}>처음으로 돌아가기 (홈 화면)</Text>
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
      navigation.reset({
        index: 0,
        routes: [{ name: 'TenantDashboard' }],
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
