import React, { useState } from 'react';
import { View, Text, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, Image, Pressable, Keyboard, TextInput, ActivityIndicator, Alert } from 'react-native';
import { LoginScreen } from '../components/auth/LoginScreen';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { appStyles } from '../styles/appStyles';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { useNotifications } from '../contexts/NotificationContext';
import { isKakaoTalk, redirectToExternalBrowser } from '../utils/browserDetection';
import { tenantsService } from '../services/tenantsService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const LandingScreen = () => {
    const { handleLoginSuccess } = useAuth();
    const { expoPushToken, webPushToken } = useNotifications();
    const { setMode, setBrandingCompany } = useUI();
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    
    // ?ÖÏ£º??Í∏ÄÎ°úÎ≤å Î°úÍ∑∏???ÅÌÉú
    const [isTenantLogin, setIsTenantLogin] = useState(false);
    const [tenantPhone, setTenantPhone] = useState('');
    const [isSearching, setIsSearching] = useState(false);

    React.useEffect(() => {
        if (isKakaoTalk()) {
            redirectToExternalBrowser();
        }

        const showSubscription = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
        const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    const handleTenantPhoneChange = (text: string) => {
        let cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned.length === 0) {
            setTenantPhone('');
            return;
        }
        if (!cleaned.startsWith('010') && cleaned.length > 0) {
            if (!cleaned.startsWith('01') && !cleaned.startsWith('0')) {
                cleaned = '010' + cleaned;
            }
        }
        let formatted = '';
        if (cleaned.length <= 3) {
            formatted = cleaned;
        } else if (cleaned.length <= 7) {
            formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
        } else if (cleaned.length <= 10) {
            formatted = `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
        } else {
            const truncated = cleaned.slice(0, 11);
            formatted = `${truncated.slice(0, 3)}-${truncated.slice(3, 7)}-${truncated.slice(7)}`;
        }
        setTenantPhone(formatted);
    };

    const handleGlobalTenantLogin = async () => {
        const fullPhone = tenantPhone.replace(/[^0-9]/g, '');
        if (fullPhone.length < 10) {
            Alert.alert('?åÎ¶º', '?ïÌôï???¥Î??ÑÌôî Î≤àÌò∏Î•??ÖÎ†•?¥Ï£º?∏Ïöî.');
            return;
        }

        setIsSearching(true);
        try {
            const match = await tenantsService.globalFindTenantByPhone(fullPhone);
            if (!match) {
                Alert.alert('?åÎ¶º', '?±Î°ù?òÏ? ?äÏ? Î≤àÌò∏?ÖÎãà??\nÍ¥ÄÎ¶¨Ïûê?êÍ≤å Ï¥àÎ?Î•??îÏ≤≠?¥Ï£º?∏Ïöî.');
                return;
            }

            // PWA ???îÎ©¥ Î≥µÍ?Î•??ÄÎπÑÌï¥ ?Ä??
            const magicUrl = `https://postnoti-app.vercel.app/view?m=${match.company_id}&p=${match.tenant_id}`;
            await AsyncStorage.setItem('last_tenant_url', magicUrl);

            // UI Context ?ÖÎç∞?¥Ìä∏ ???ÖÏ£º???îÎ©¥?ºÎ°ú ?ÑÌôò
            setBrandingCompany({
                id: match.company_id,
                name: match.company_name,
                magicId: match.company_id,
                targetTenantId: match.tenant_id
            } as any);
            setMode('tenant_login');

        } catch (e) {
            console.error(e);
            Alert.alert('?§Î•ò', 'Ï°∞Ìöå Ï§?Î¨∏Ï†úÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§.');
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <SafeAreaView style={appStyles.flexContainer}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={appStyles.flexContainer}
            >
                <ScrollView
                    style={appStyles.flexContainer}
                    contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }}
                    keyboardShouldPersistTaps="handled"
                >
                    {isKakaoTalk() && (
                        <View style={{
                            backgroundColor: '#FEE2E2',
                            padding: 12,
                            alignItems: 'center',
                            borderBottomWidth: 1,
                            borderBottomColor: '#F87171'
                        }}>
                            <Text style={{ color: '#991B1B', fontWeight: '700', fontSize: 13, textAlign: 'center' }}>
                                ?†Ô∏è Ïπ¥Ïπ¥?§ÌÜ° Î∏åÎùº?∞Ï??êÏÑú???åÎ¶º???ëÎèô?òÏ? ?äÏäµ?àÎã§.{"\n"}
                                ?§Î•∏Ï™???[¬∑¬∑¬∑] Î≤ÑÌäº ?¥Î¶≠ ??[?§Î•∏ Î∏åÎùº?∞Ï?Î°??¥Í∏∞]Î•??¥Ï£º?∏Ïöî!
                            </Text>
                        </View>
                    )}
                    <View style={{ flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
                        <View style={{ marginBottom: keyboardVisible ? 10 : 30, marginTop: keyboardVisible ? 20 : 40, alignItems: 'center' }}>
                            <Image
                                source={require('../../assets/logo.png')}
                                style={{
                                    width: keyboardVisible ? 60 : 90,
                                    height: keyboardVisible ? 60 : 90,
                                    borderRadius: keyboardVisible ? 15 : 24
                                }}
                                resizeMode="contain"
                            />
                            <Text style={{ fontSize: 16, color: '#475569', fontWeight: '800', marginTop: 15 }}>?§Îßà?∏Ïö∞?∏ÏïåÎ¶?- ?¨Ïä§?∏ÎÖ∏??/Text>
                        </View>

                        <View style={appStyles.actionSection}>
                            <View style={[appStyles.loginCardDirect, {
                                elevation: 15,
                                shadowColor: '#000',
                                shadowOffset: { width: 0, height: 10 },
                                shadowOpacity: 0.1,
                                shadowRadius: 20,
                                paddingHorizontal: 30,
                                paddingVertical: keyboardVisible ? 15 : 20,
                                backgroundColor: '#FFFFFF',
                                borderRadius: 30,
                                marginHorizontal: 4
                            }]}>
                                {isTenantLogin ? (
                                    <View>
                                        <Text style={{ fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 20, textAlign: 'center' }}>?ÖÏ£º??Îπ†Î•∏ Î°úÍ∑∏??/Text>
                                        <View style={{ marginBottom: 20 }}>
                                            <Text style={{ fontSize: 14, fontWeight: '600', color: '#64748B', marginBottom: 8 }}>?±Î°ù???¥Î??ÑÌôî Î≤àÌò∏</Text>
                                            <TextInput
                                                style={{
                                                    backgroundColor: '#F8FAFC',
                                                    borderWidth: 1,
                                                    borderColor: '#E2E8F0',
                                                    borderRadius: 16,
                                                    paddingHorizontal: 18,
                                                    height: 56,
                                                    fontSize: 16,
                                                    color: '#1E293B'
                                                }}
                                                value={tenantPhone}
                                                onChangeText={handleTenantPhoneChange}
                                                placeholder="010-0000-0000"
                                                placeholderTextColor="#94A3B8"
                                                keyboardType="number-pad"
                                                maxLength={13}
                                            />
                                        </View>
                                        <PrimaryButton
                                            label={isSearching ? "?ïÏù∏ Ï§?.." : "?∞Ìé∏Î¨??ïÏù∏?òÍ∏∞"}
                                            onPress={handleGlobalTenantLogin}
                                            loading={isSearching}
                                            style={{ backgroundColor: '#4F46E5', borderRadius: 16, height: 56 }}
                                        />
                                        <Pressable onPress={() => setIsTenantLogin(false)} style={{ marginTop: 20, alignItems: 'center', padding: 10 }}>
                                            <Text style={{ color: '#64748B', fontWeight: '600' }}>Í¥ÄÎ¶¨Ïûê?¥Ïã†Í∞Ä?? <Text style={{ color: '#4F46E5' }}>Í¥ÄÎ¶¨Ïûê Î°úÍ∑∏??/Text></Text>
                                        </Pressable>
                                    </View>
                                ) : (
                                    <View>
                                        <LoginScreen
                                            onLoginSuccess={async (profile) => {
                                                await handleLoginSuccess(profile, expoPushToken, webPushToken);
                                                setMode('admin_dashboard');
                                            }}
                                            onBack={() => { }}
                                            isEmbedded={true}
                                        />
                                        <Pressable onPress={() => setIsTenantLogin(true)} style={{ marginTop: 20, alignItems: 'center', padding: 10, backgroundColor: '#EEF2FF', borderRadius: 12 }}>
                                            <Text style={{ color: '#4F46E5', fontWeight: '700' }}>?πÏãú ?ÖÏ£º?êÏù¥?†Í??? Î≤àÌò∏Î°?Í∞ÑÌé∏ Î°úÍ∑∏???ëâ</Text>
                                        </Pressable>
                                    </View>
                                )}
                            </View>

                            {!isTenantLogin && (
                                <Pressable
                                    onPress={() => setMode('admin_signup')}
                                    style={{ marginTop: 40, alignItems: 'center' }}
                                >
                                    <Text style={{ fontSize: 16, color: '#64748B' }}>
                                        ?ÑÏßÅ Í≥ÑÏ†ï???ÜÏúº?†Í???{' '}
                                        <Text style={{ color: '#6366F1', fontWeight: '700', textDecorationLine: 'underline' }}>?§Ìîº???±Î°ù?òÍ∏∞</Text>
                                    </Text>
                                </Pressable>
                            )}
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};
