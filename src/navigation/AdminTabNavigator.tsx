import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminDashboardScreen } from '../screens/AdminDashboardScreen';
import { AdminTenantsScreen } from '../screens/AdminTenantsScreen';
import { AdminMenuScreen } from '../screens/AdminMenuScreen';
import { AdminNoticeScreen } from '../screens/admin/AdminNoticeScreen';
import { DeliveryScreen } from '../screens/admin/DeliveryScreen';
import { useAppContent } from '../contexts/AppContext';

const Tab = createBottomTabNavigator();

export const AdminTabNavigator = () => {
    const insets = useSafeAreaInsets();
    const { pendingDeliveryCount, loadPendingDeliveryCount, officeInfo } = useAppContent();

    // 탭 네비게이터가 렌더링되거나 오피스 정보가 바뀔 때 한 번 더 갱신
    React.useEffect(() => {
        if (officeInfo?.id) {
            loadPendingDeliveryCount();
        }
    }, [officeInfo?.id]);

    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName: any;

                    if (route.name === 'Dashboard') {
                        iconName = focused ? 'mail-open' : 'mail-outline';
                    } else if (route.name === 'Tenants') {
                        iconName = focused ? 'business' : 'business-outline';
                    } else if (route.name === 'MailDelivery') {
                        iconName = focused ? 'paper-plane' : 'paper-plane-outline';
                    } else if (route.name === 'Announcements') {
                        iconName = focused ? 'megaphone' : 'megaphone-outline';
                    } else if (route.name === 'Settings') {
                        iconName = focused ? 'settings' : 'settings-outline';
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
                headerShown: false, // Each screen will handle its own header if needed
            })}
        >
            <Tab.Screen
                name="Dashboard"
                component={AdminDashboardScreen}
                options={{ tabBarLabel: '우편함' }}
            />
            <Tab.Screen
                name="Tenants"
                component={AdminTenantsScreen}
                options={{ tabBarLabel: '입주사' }}
            />
            <Tab.Screen
                name="MailDelivery"
                component={DeliveryScreen}
                options={{
                    tabBarLabel: '우편전달',
                    tabBarBadge: pendingDeliveryCount > 0 ? pendingDeliveryCount : undefined
                }}
            />
            <Tab.Screen
                name="Announcements"
                component={AdminNoticeScreen}
                options={{ tabBarLabel: '공지사항' }}
            />
            <Tab.Screen
                name="Settings"
                component={AdminMenuScreen}
                options={{ tabBarLabel: '관리' }}
            />
        </Tab.Navigator>
    );
};
