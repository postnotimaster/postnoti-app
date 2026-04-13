import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppProvider, useAppContent } from './src/contexts/AppContext';

// Screens
import { LandingScreen } from './src/screens/LandingScreen';
import { AdminDashboardScreen } from './src/screens/AdminDashboardScreen';
import { AdminRegisterMailScreen } from './src/screens/AdminRegisterMailScreen';
import { TenantDashboard } from './src/components/tenant/TenantDashboard';
import { KakaoGuideOverlay } from './src/components/common/KakaoGuideOverlay';
// Note: TenantDashboard is still in components, can be moved later. 
// We will wrap it in a Screen component if needed or use directly if it accepts navigation props, 
// but existing TenantDashboard uses 'onBack'. We should adapt it.

const Stack = createNativeStackNavigator();

function AppContent() {
  const { isInitializing, mode, brandingCompany, expoPushToken, webPushToken, setMode } = useAppContent();
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

  // Tenant Dashboard Wrapper to adapt 'onBack'
  const TenantDashboardWrapper = ({ navigation }: any) => {
    // If brandingCompany not set, go back to Landing
    if (!brandingCompany) {
      // navigation.replace('Landing'); // Effect?
      return null;
    }
    return (
      <TenantDashboard
        companyId={brandingCompany.id}
        companyName={brandingCompany.name}
        pushToken={expoPushToken}
        webPushToken={webPushToken}
        onBack={() => {
          setMode('landing');
          navigation.popToTop();
        }}
      />
    );
  };

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* If context says tenant_login, we effectively want to show TenantDashboard. 
            However, defining initialRouteName based on state is tricky in RN. 
            Instead, we rely on the fact that if 'mode' was set to 'tenant_login' during init, 
            we should navigate there. 
            
            Let's keep it simple: Start at Landing. 
            Context's deep link listener will triggered, setMode, and ideally we navigate.
            
            Wait, AppContext deep link logic sets 'mode'. 
            It doesn't have access to 'navigation' object.
            We need a navigator reference.
        */}
        <Stack.Screen name="Landing" component={LandingScreen} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
        <Stack.Screen name="AdminRegisterMail" component={AdminRegisterMailScreen} />

        {/* Special Case: Tenant Dashboard */}
        <Stack.Screen name="TenantDashboard" component={TenantDashboardWrapper} />
      </Stack.Navigator>

      {/* Bridge Component to handle Context-driven navigation (Deep Links) */}
      <NavigationBridge />

      {/* KakaoTalk 외부 브라우저 유도 오버레이 */}
      <KakaoGuideOverlay />
    </NavigationContainer>
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
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
