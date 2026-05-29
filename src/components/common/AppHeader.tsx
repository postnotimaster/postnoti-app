import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';

type Props = {
    title: string;
    onBack?: () => void;
    onMenu?: () => void;
};

export const AppHeader = ({ title, onBack, onMenu }: Props) => {
    return (
        <View style={styles.header}>
            <View style={styles.sideContainer}>
                {onBack && (
                    <Pressable onPress={onBack} style={styles.backButton}>
                        <Text style={styles.backText}>←</Text>
                    </Pressable>
                )}
            </View>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <View style={styles.sideContainer}>
                {onMenu && (
                    <Pressable onPress={onMenu} style={styles.menuButton}>
                        <Text style={styles.menuText}>☰</Text>
                    </Pressable>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        height: 56, // Reduced height for standard mobile header (SafeArea handles notch)
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center', // Center align vertically
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    sideContainer: {
        width: 50,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backText: {
        fontSize: 22,
        color: '#1E293B',
        fontWeight: '300', // Thinner arrow
    },
    menuButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuText: {
        fontSize: 22,
        color: '#1E293B',
        fontWeight: '300',
    },
    title: {
        fontSize: 18,
        fontWeight: '700', // Consistent header weight
        color: '#1E293B',
        flex: 1,
        textAlign: 'center',
    },
});
