import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, ActivityIndicator, Pressable } from 'react-native';
import { supabase } from '../../lib/supabase';
import { PrimaryButton } from '../common/PrimaryButton';

type Props = {
    onLoginSuccess: (profile: any) => void;
    onBack: () => void;
    isEmbedded?: boolean;
};

export const LoginScreen = ({ onLoginSuccess, onBack, isEmbedded }: Props) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        // ... 기존 로그인 로직 유지
        if (!email || !password) {
            Alert.alert('알림', '이메일과 비밀번호를 입력해주세요.');
            return;
        }

        setLoading(true);
        try {
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email, password,
            });
            if (authError) throw authError;

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*, companies(*)')
                .eq('id', authData.user!.id)
                .single();

            if (profileError || profile.role !== 'admin') {
                throw new Error('관리자 권한이 없거나 프로필 설정을 확인해주세요.');
            }
            onLoginSuccess(profile);
        } catch (error: any) {
            Alert.alert('로그인 실패', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={isEmbedded ? null : styles.container}>
            <View style={isEmbedded ? styles.embeddedContent : styles.content}>
                {!isEmbedded && (
                    <View style={styles.header}>
                        <Text style={styles.title}>관리자 로그인</Text>
                        <Text style={styles.subtitle}>지점 관리자 전용 페이지입니다.</Text>
                    </View>
                )}

                <View style={styles.form}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>이메일</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="admin@postnoti.com"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>비밀번호</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="비밀번호 입력"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 20 }} />
                    ) : (
                        <View style={{ gap: 10 }}>
                            <PrimaryButton
                                label="로그인"
                                onPress={handleLogin}
                                style={styles.loginButton}
                            />

                            {!isEmbedded && (
                                <PrimaryButton
                                    label="돌아가기"
                                    onPress={onBack}
                                    style={styles.backButton}
                                    textStyle={{ color: '#64748B' }}
                                />
                            )}
                        </View>
                    )}

                    {/* 개발용 단축 입력 */}
                    <Pressable
                        style={{ marginTop: 10, alignItems: 'center' }}
                        onPress={() => {
                            setEmail('admin@postnoti.com');
                            setPassword('289400');
                        }}
                    >
                        <Text style={{ color: '#CBD5E1', fontSize: 11 }}>자동입력 [admin / 289400]</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        justifyContent: 'center',
        padding: 20,
    },
    content: {
        backgroundColor: '#FFFFFF',
        padding: 30,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        maxWidth: 400,
        width: '100%',
        alignSelf: 'center',
        elevation: 4,
    },
    embeddedContent: {
        width: '100%',
    },
    header: {
        marginBottom: 30,
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#64748B',
    },
    form: {
        gap: 16,
    },
    inputGroup: {
        gap: 6,
    },
    label: {
        fontSize: 13,
        fontWeight: '700',
        color: '#475467',
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        fontSize: 15,
        color: '#1E293B',
    },
    loginButton: {
        width: '100%',
        backgroundColor: '#1E293B',
        height: 52,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    backButton: {
        width: '100%',
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        height: 52,
        borderRadius: 14,
    },
});
