import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useUI, AppMode } from '../../contexts/UIContext';
import { useNotifications } from '../../contexts/NotificationContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const AdminTabBar = () => {
    const { mode, setMode } = useUI();
    const { pendingDeliveryCount } = useNotifications();
    const insets = useSafeAreaInsets();

    const tabs: { mode: AppMode; label: string; icon: any; activeIcon: any }[] = [
        { mode: 'admin_dashboard', label: '우편함', icon: 'mail-outline', activeIcon: 'mail-open' },
        { mode: 'admin_tenants', label: '입주사', icon: 'business-outline', activeIcon: 'business' },
        { mode: 'admin_delivery', label: '우편전달', icon: 'paper-plane-outline', activeIcon: 'paper-plane' },
        { mode: 'admin_announcements', label: '공지사항', icon: 'megaphone-outline', activeIcon: 'megaphone' },
        { mode: 'admin_menu', label: '관리', icon: 'settings-outline', activeIcon: 'settings' },
    ];

    return (
        <View style={[
            styles.container, 
            { 
                height: (insets.bottom > 0 ? 65 + insets.bottom : 75),
                paddingBottom: (insets.bottom > 0 ? insets.bottom + 8 : 15),
            }
        ]}>
            {tabs.map((tab) => {
                const isActive = mode === tab.mode;
                const isDelivery = tab.mode === 'admin_delivery';

                return (
                    <Pressable
                        key={tab.mode}
                        onPress={() => setMode(tab.mode)}
                        style={styles.tabItem}
                    >
                        <View style={styles.iconContainer}>
                            <Ionicons 
                                name={isActive ? tab.activeIcon : tab.icon} 
                                size={24} 
                                color={isActive ? '#4F46E5' : '#64748B'} 
                            />
                            {isDelivery && pendingDeliveryCount > 0 && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>{pendingDeliveryCount}</Text>
                                </View>
                            )}
                        </View>
                        <Text style={[
                            styles.label, 
                            { color: isActive ? '#4F46E5' : '#64748B', fontWeight: isActive ? '800' : '600' }
                        ]}>
                            {tab.label}
                        </Text>
                    </Pressable>
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 10,
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 15,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        marginBottom: 4,
        position: 'relative',
    },
    label: {
        fontSize: 11,
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -8,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
        borderWidth: 2,
        borderColor: '#fff',
    },
    badgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
    },
});
