import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Alert, ActivityIndicator, Pressable, Image, KeyboardAvoidingView, Platform, SafeAreaView, BackHandler } from 'react-native';
import { supabase } from '../lib/supabase';
import { companiesService } from '../services/companiesService';
import { profilesService } from '../services/profilesService';
import { PrimaryButton } from '../components/common/PrimaryButton';
import { appStyles } from '../styles/appStyles';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';

export const AdminSignupScreen = () => {
    const { setOfficeInfo } = useAuth();
    const { setMode } = useUI();

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const onBackAction = () => {
            if (step === 2) {
                setStep(1);
                return true;
            }
            return false; // step 1???ŒëŠ” ?„ì—­ ?¸ë“¤?¬ì—??landing?¼ë¡œ ?´ë™?˜ë„ë¡?false ë°˜í™˜
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackAction);
        return () => backHandler.remove();
    }, [step]);

    // Step 1: Account
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Step 2: Office & Manager Info
    const [companyName, setCompanyName] = useState('');
    const [businessNumber, setBusinessNumber] = useState('');
    const [managerName, setManagerName] = useState('');
    const [phone, setPhone] = useState('');
    const [slug, setSlug] = useState('');

    const [isSlugChecked, setIsSlugChecked] = useState(false);
    const [isSlugChecking, setIsSlugChecking] = useState(false);

    const formatBusinessNumber = (text: string) => {
        const cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned.length <= 3) return cleaned;
        if (cleaned.length <= 5) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 5)}-${cleaned.slice(5, 10)}`;
    };

    const formatPhone = (text: string) => {
        const cleaned = text.replace(/[^0-9]/g, '');
        if (cleaned.length <= 3) return cleaned;
        if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7, 11)}`;
    };

    const handleCheckSlug = async () => {
        if (!slug || slug.length < 2) {
            Alert.alert('?Œë¦¼', '?„ìš© ì£¼ì†Œë¥?2???´ìƒ ?…ë ¥?´ì£¼?¸ìš”.');
            return;
        }
        setIsSlugChecking(true);
        try {
            const isUnique = await companiesService.checkSlugUnique(slug);
            if (isUnique) {
                setIsSlugChecked(true);
                Alert.alert('?•ì¸ ?„ë£Œ', '?¬ìš© ê°€?¥í•œ ì£¼ì†Œ?…ë‹ˆ??');
            } else {
                setIsSlugChecked(false);
                Alert.alert('ì¤‘ë³µ ì£¼ì†Œ', '?´ë? ?¬ìš© ì¤‘ì¸ ì£¼ì†Œ?…ë‹ˆ?? ?¤ë¥¸ ì£¼ì†Œë¥??…ë ¥?´ì£¼?¸ìš”.');
            }
        } catch (error) {
            Alert.alert('?¤ë¥˜', 'ì£¼ì†Œ ì¤‘ë³µ ?•ì¸ ì¤?ë¬¸ì œê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.');
        } finally {
            setIsSlugChecking(false);
        }
    };

    const handleNextStep = async () => {
        if (step === 1) {
            if (!email || !password || !confirmPassword) {
                Alert.alert('?Œë¦¼', '?´ë©”?¼ê³¼ ë¹„ë?ë²ˆí˜¸ ?•ë³´ë¥?ëª¨ë‘ ?…ë ¥?´ì£¼?¸ìš”.');
                return;
            }
            if (password !== confirmPassword) {
                Alert.alert('?Œë¦¼', 'ë¹„ë?ë²ˆí˜¸ê°€ ?¼ì¹˜?˜ì? ?ŠìŠµ?ˆë‹¤.');
                return;
            }
            if (password.length < 6) {
                Alert.alert('?Œë¦¼', 'ë¹„ë?ë²ˆí˜¸??ìµœì†Œ 6?ë¦¬ ?´ìƒ?´ì–´???©ë‹ˆ??');
                return;
            }
            setStep(2);
        }
    };

    const handleSignup = async () => {
        if (!companyName || !businessNumber || !managerName || !phone || !slug) {
            Alert.alert('?Œë¦¼', '?¤í”¼???•ë³´?€ ê´€ë¦¬ì ?•ë³´ë¥?ëª¨ë‘ ?…ë ¥?´ì£¼?¸ìš”.');
            return;
        }

        if (!isSlugChecked) {
            Alert.alert('?Œë¦¼', '?¤í”¼???„ìš© ì£¼ì†Œ ì¤‘ë³µ ?•ì¸??ë¨¼ì? ì§„í–‰?´ì£¼?¸ìš”.');
            return;
        }

        setLoading(true);
        try {
            // 2ì¤?ì²´í¬ (?¹ì‹œ ê²€ì¦???ê·¸ìƒˆ ?„ê? ?¼ì„ ?˜ë„ ?ˆìœ¼??
            const isUnique = await companiesService.checkSlugUnique(slug);
            if (!isUnique) {
                setIsSlugChecked(false);
                Alert.alert('ì¤‘ë³µ ì£¼ì†Œ', 'ê·??¬ì´ ì£¼ì†Œê°€ ?¬ìš©?˜ì—ˆ?µë‹ˆ?? ?¤ë¥¸ ì£¼ì†Œë¡?ë³€ê²½í•´ì£¼ì„¸??');
                setLoading(false);
                return;
            }

            // 2. Auth ?Œì›ê°€??
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
            });
            if (authError) throw authError;
            if (!authData.user) throw new Error('ê³„ì • ?ì„±???¤íŒ¨?ˆìŠµ?ˆë‹¤.');

            // 3. ?¤í”¼??Company) ?ì„±
            const company = await companiesService.createCompany(companyName, '', slug, businessNumber);

            // 4. ê´€ë¦¬ì ?„ë¡œ??Profile) ?ì„±
            await profilesService.createProfile({
                id: authData.user.id,
                company_id: company.id,
                name: managerName,
                phone: phone,
                role: 'admin',
                is_active: true
            });

            // 5. ?„ë£Œ ì²˜ë¦¬
            setOfficeInfo(company);
            setMode('admin_dashboard');
            Alert.alert('ê°€???„ë£Œ', '?¬ìŠ¤?¸ë…¸???¤í”¼??ê°€?…ì´ ?„ë£Œ?˜ì—ˆ?µë‹ˆ??');

        } catch (error: any) {
            Alert.alert('ê°€???¤íŒ¨', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={appStyles.safeArea}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    style={{ flex: 1, backgroundColor: '#FFFFFF' }}
                    contentContainerStyle={{ padding: 24, paddingTop: 40, paddingBottom: 60 }}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={{ marginBottom: 40 }}>
                        <Text style={{ fontSize: 28, fontWeight: '800', color: '#1E293B', textAlign: 'center' }}>?¤í”¼???±ë¡?˜ê¸°</Text>
                        <Text style={{ fontSize: 15, color: '#64748B', marginTop: 8, textAlign: 'center' }}>
                            {step === 1 ? 'ê´€ë¦¬ì ê³„ì •??ë¨¼ì? ?ì„±??ì£¼ì„¸?? : '?´ì˜?˜ì‹¤ ?¤í”¼???•ë³´ë¥??…ë ¥??ì£¼ì„¸??}
                        </Text>

                        <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, paddingHorizontal: 40 }}>
                            <View style={{ height: 6, flex: 1, backgroundColor: step >= 1 ? '#6366F1' : '#F1F5F9', borderRadius: 3 }} />
                            <View style={{ height: 6, flex: 1, backgroundColor: step >= 2 ? '#6366F1' : '#F1F5F9', borderRadius: 3 }} />
                        </View>
                    </View>

                    {step === 1 ? (
                        <View style={[appStyles.loginCardDirect, {
                            elevation: 10,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.08,
                            shadowRadius: 12,
                            padding: 24,
                            backgroundColor: '#FFFFFF',
                            borderRadius: 24,
                            marginHorizontal: 4
                        }]}>
                            <View style={appStyles.inputGroup}>
                                <Text style={appStyles.label}>?´ë©”??ì£¼ì†Œ</Text>
                                <TextInput
                                    style={appStyles.input}
                                    value={email}
                                    onChangeText={setEmail}
                                    placeholder="admin@example.com"
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                            <View style={appStyles.inputGroup}>
                                <Text style={appStyles.label}>ë¹„ë?ë²ˆí˜¸ (6?ë¦¬ ?´ìƒ)</Text>
                                <TextInput
                                    style={appStyles.input}
                                    value={password}
                                    onChangeText={setPassword}
                                    placeholder="******"
                                    secureTextEntry
                                />
                            </View>
                            <View style={appStyles.inputGroup}>
                                <Text style={appStyles.label}>ë¹„ë?ë²ˆí˜¸ ?•ì¸</Text>
                                <TextInput
                                    style={appStyles.input}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    placeholder="ë¹„ë?ë²ˆí˜¸ë¥???ë²????…ë ¥?˜ì„¸??
                                    secureTextEntry
                                />
                            </View>
                            <PrimaryButton
                                label="?¤ìŒ ?¨ê³„ë¡?(?¤í”¼???•ë³´ ?…ë ¥)"
                                onPress={handleNextStep}
                                style={{ marginTop: 20, width: '100%', height: 56, backgroundColor: '#6366F1' }}
                            />
                        </View>
                    ) : (
                        <View style={[appStyles.loginCardDirect, {
                            elevation: 10,
                            shadowColor: '#000',
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.08,
                            shadowRadius: 12,
                            padding: 24,
                            backgroundColor: '#FFFFFF',
                            borderRadius: 24,
                            marginHorizontal: 4
                        }]}>
                            <View style={appStyles.inputGroup}>
                                <Text style={appStyles.label}>?¤í”¼??ëª…ì¹­ (?? ?¬ìŠ¤?¸ë…¸??ì¢…ë¡œ??</Text>
                                <TextInput
                                    style={appStyles.input}
                                    value={companyName}
                                    onChangeText={setCompanyName}
                                    placeholder="?¤í”¼???´ë¦„???…ë ¥?˜ì„¸??
                                />
                            </View>
                            <View style={appStyles.inputGroup}>
                                <Text style={appStyles.label}>?¬ì—…???±ë¡ ë²ˆí˜¸</Text>
                                <TextInput
                                    style={appStyles.input}
                                    value={businessNumber}
                                    onChangeText={(t) => setBusinessNumber(formatBusinessNumber(t))}
                                    placeholder="000-00-00000"
                                    keyboardType="numeric"
                                    maxLength={12}
                                />
                            </View>

                            <View style={appStyles.inputGroup}>
                                <Text style={appStyles.label}>ê´€ë¦¬ì ?±í•¨ (?¤ëª…)</Text>
                                <TextInput
                                    style={appStyles.input}
                                    value={managerName}
                                    onChangeText={setManagerName}
                                    placeholder="?ê¸¸??
                                />
                            </View>

                            <View style={appStyles.inputGroup}>
                                <Text style={appStyles.label}>ê´€ë¦¬ì ?°ë½ì²?/Text>
                                <TextInput
                                    style={appStyles.input}
                                    value={phone}
                                    onChangeText={(t) => setPhone(formatPhone(t))}
                                    placeholder="010-1234-5678"
                                    keyboardType="phone-pad"
                                    maxLength={13}
                                />
                            </View>

                            <View style={appStyles.inputGroup}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Text style={appStyles.label}>?¤í”¼???„ìš© ?‘ì† ì£¼ì†Œ (?ë¬¸/?«ì)</Text>
                                    <Pressable
                                        onPress={handleCheckSlug}
                                        style={{ backgroundColor: isSlugChecked ? '#10B981' : '#6366F1', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 }}
                                        disabled={isSlugChecking}
                                    >
                                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>
                                            {isSlugChecking ? '?•ì¸ ì¤?..' : isSlugChecked ? '?•ì¸ ?„ë£Œ' : 'ì¤‘ë³µ ?•ì¸'}
                                        </Text>
                                    </Pressable>
                                </View>
                                <View style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    backgroundColor: '#F1F5F9',
                                    borderRadius: 8,
                                    paddingLeft: 12,
                                    borderWidth: 1,
                                    borderColor: isSlugChecked ? '#10B981' : 'transparent'
                                }}>
                                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>postnoti-app.vercel.app/</Text>
                                    <TextInput
                                        style={[appStyles.input, { flex: 1, backgroundColor: 'transparent', borderWidth: 0 }]}
                                        value={slug}
                                        onChangeText={(t) => {
                                            setSlug(t.toLowerCase().replace(/[^a-z0-9-]/g, ''));
                                            setIsSlugChecked(false); // ì£¼ì†Œ ë°”ë€Œë©´ ?¤ì‹œ ì²´í¬?´ì•¼ ??
                                        }}
                                        placeholder="ì§€?ëª… (?? seocho)"
                                        autoCapitalize="none"
                                    />
                                </View>
                                {isSlugChecked && (
                                    <Text style={{ fontSize: 11, color: '#10B981', marginTop: 4 }}>?¬ìš© ê°€?¥í•œ ì£¼ì†Œ?…ë‹ˆ??</Text>
                                )}
                            </View>

                            {loading ? (
                                <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 20 }} />
                            ) : (
                                <View style={{ gap: 12, marginTop: 24 }}>
                                    <PrimaryButton
                                        label="?¤í”¼??ê°€???„ë£Œ"
                                        onPress={handleSignup}
                                        style={{ width: '100%', height: 56, backgroundColor: '#1E293B' }}
                                    />
                                    <Pressable onPress={() => setStep(1)} style={{ alignItems: 'center', padding: 10 }}>
                                        <Text style={{ color: '#94A3B8', fontWeight: '600' }}>?´ì „ ?¨ê³„ë¡??Œì•„ê°€ê¸?/Text>
                                    </Pressable>
                                </View>
                            )}
                        </View>
                    )}

                    <Pressable
                        onPress={() => setMode('landing')}
                        style={{ marginTop: 40, alignItems: 'center' }}
                    >
                        <Text style={{ color: '#94A3B8', fontSize: 14 }}>?´ë? ê°€?…í•˜?¨ë‚˜?? ë¡œê·¸?¸í•˜ê¸?/Text>
                    </Pressable>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};
