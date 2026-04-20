import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TenantDashboard } from '../components/tenant/TenantDashboard';
import { NoticeListScreen } from '../screens/tenant/NoticeListScreen';

const Tab = createBottomTabNavigator();

export const TenantTabNavigator = ({ route }: any) => {
    const insets = useSafeAreaInsets();
    const { companyId, companyName, pushToken, webPushToken, magicProfileId, magicTenantId, onBack } = route.params;

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName: any;

                    if (route.name === 'Mailbox') {
                        iconName = focused ? 'mail' : 'mail-outline';
                    } else if (route.name === 'Notice') {
                        iconName = focused ? 'megaphone' : 'megaphone-outline';
                    }

                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: '#4F46E5',
                tabBarInactiveTintColor: '#64748B',
                tabBarStyle: {
                    height: (insets.bottom > 0 ? 65 + insets.bottom : 75),
                    paddingBottom: (insets.bottom > 0 ? insets.bottom + 8 : 15),
                    paddingTop: 10,
                    borderTopWidth: 1,
                    borderTopColor: '#F1F5F9',
                    backgroundColor: '#fff',
                    elevation: 15,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.05,
                    shadowRadius: 10,
                },
                tabBarLabelStyle: {
                    fontSize: 12,
                    fontWeight: '700',
                    marginTop: -4,
                },
                headerShown: false,
            })}
        >
            <Tab.Screen
                name="Mailbox"
                options={{ tabBarLabel: '우편함' }}
            >
                {(props) => (
                    <TenantDashboard
                        {...props}
                        companyId={companyId}
                        companyName={companyName}
                        pushToken={pushToken}
                        webPushToken={webPushToken}
                        magicProfileId={magicProfileId}
                        magicTenantId={magicTenantId}
                        onBack={onBack}
                    />
                )}
            </Tab.Screen>
            <Tab.Screen
                name="Notice"
                component={NoticeListScreen}
                options={{ tabBarLabel: '공지사항' }}
            />
        </Tab.Navigator>
    );
};
