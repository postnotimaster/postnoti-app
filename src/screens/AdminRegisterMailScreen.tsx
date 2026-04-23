import React from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, TextInput, Modal, Alert, Linking, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { notificationService, NotificationResult } from '../services/notificationService';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAppContent } from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { SectionCard } from '../components/common/SectionCard';
import { PrimaryButton } from '../components/common/PrimaryButton';

export const AdminRegisterMailScreen = () => {
    const navigation = useNavigation<any>();
    const { showToast } = useToast();
    const {
        selectedImage,
        ocrLoading,
        runOCR,
        setOcrLoading,
        setSelectedImage,
        matchedProfile,
        setMatchedProfile,
        profiles,
        detectedSender,
        setDetectedSender,
        detectedMailType,
        setDetectedMailType,
        extraImages,
        setExtraImages,
        handleRegisterMail,
        isManualSearchVisible,
        setIsManualSearchVisible,
        manualSearchQuery,
        setManualSearchQuery,
        ocrPreprocess,
        optimizeImage,
        officeInfo,
        resetOCR,
        setSelectedProfileForHistory,
        setIsHistoryVisible
    } = useAppContent() as any;

    const [customMessage, setCustomMessage] = React.useState('');
    const [selectedPreset, setSelectedPreset] = React.useState<string | null>(null);
    const [resultModalVisible, setResultModalVisible] = React.useState(false);
    const [lastNotifResult, setLastNotifResult] = React.useState<NotificationResult | null>(null);

    const prevOcrLoading = React.useRef(ocrLoading);

    React.useEffect(() => {
        if (prevOcrLoading.current === true && ocrLoading === false) {
            if (matchedProfile) {
                const status = matchedProfile.status || (matchedProfile.is_active ? '입주' : '퇴거');
                if (status !== '입주') {
                    const compName = matchedProfile.company_name || '(미등록)';
                    Alert.alert(
                        `⚠️ 주의: [${status}] 상태 입주사`,
                        `진단 대상: ${compName} / ${matchedProfile.name}\n이 입주사는 현재 [${status}] 상태입니다.\n\n다른 우편물을 찍으시겠습니까? 아니면 해당 입주사의 정보 페이지로 가시겠습니까?`,
                        [
                            {
                                text: '📷 다시 촬영',
                                onPress: async () => {
                                    const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
                                    if (!result.canceled) runOCR(result.assets[0].uri);
                                }
                            },
                            {
                                text: '해당 입주사 정보 보기',
                                onPress: () => {
                                    resetOCR();
                                    setSelectedProfileForHistory(matchedProfile);
                                    setIsHistoryVisible(true);
                                    navigation.navigate('AdminHome');
                                }
                            },
                            {
                                text: '무시하고 등록 진행',
                                style: 'cancel'
                            }
                        ]
                    );
                }
            }
        }
        prevOcrLoading.current = ocrLoading;
    }, [ocrLoading, matchedProfile, runOCR, resetOCR, setSelectedProfileForHistory, setIsHistoryVisible, navigation]);

    const presets = [
        "주문하신 택배가 도착했습니다 📦",
        "중요 등기 우편이 도착했습니다 ✉️",
        "일반 우편물이 도착했습니다 📮",
        "물품은 입구 데스크에서 수령 가능합니다 💁",
        "택배함에 보관해 두었습니다 🔒"
    ];

    const onSubmit = async () => {
        try {
            const finalMessage = selectedPreset || customMessage || undefined;
            const result = await handleRegisterMail(
                matchedProfile,
                selectedImage,
                detectedMailType,
                detectedSender,
                extraImages,
                finalMessage
            );

            if (result) {
                setLastNotifResult(result);
                if (result.success) {
                    Alert.alert('발송 완료', '입주사에게 앱 알림을 보냈습니다.', [
                        { text: '확인', onPress: () => handleSuccessFinish() }
                    ]);
                } else {
                    setResultModalVisible(true);
                }
            }
        } catch (e: any) {
            console.error('[AdminRegisterMail] onSubmit error:', e);
            Alert.alert('등록 오류', `문제가 발생했습니다: ${e.message}`);
        }
    };

    const handleSuccessFinish = () => {
        setCustomMessage('');
        setSelectedPreset(null);
        setResultModalVisible(false);
        if (resetOCR) resetOCR(); // 화면을 나갈 때 초기화
        navigation.navigate('AdminHome');
    };

    const handleSmsFallback = async () => {
        if (!officeInfo) {
            showToast({ message: '오피스 지점 정보가 없습니다.', type: 'error' });
            return;
        }
        if (!matchedProfile) {
            showToast({ message: '입주사 정보가 없습니다.', type: 'error' });
            return;
        }
        if (!lastNotifResult) {
            showToast({ message: '알림 전송 결과 데이터가 없습니다.', type: 'error' });
            return;
        }

        const phone = lastNotifResult.targetPhone || matchedProfile.phone;
        if (!phone) {
            showToast({ message: '입주사의 전화번호가 없습니다.', type: 'error' });
            return;
        }

        let message = notificationService.getShareMessage(matchedProfile, officeInfo);

        // 개발 환경/테스트 모드일 때 메시지의 링크를 현재 오리진으로 치환
        if (Platform.OS === 'web') {
            const currentOrigin = window.location.origin;
            message = message.replace('https://postnoti-app-two.vercel.app', currentOrigin);
        }

        // Android와 iOS의 SMS URL 구분자 처리 (? vs &)
        const separator = Platform.OS === 'ios' ? '&' : '?';
        const url = `sms:${phone}${separator}body=${encodeURIComponent(message)}`;

        try {
            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
            } else {
                // 대체 방법: 번호만 넣어서 열기
                await Linking.openURL(`sms:${phone}`);
            }
            handleSuccessFinish();
        } catch (e) {
            console.error('SMS open failed', e);
            showToast({ message: '메시지 앱을 열 수 없습니다.', type: 'error' });
        }
    };

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate('AdminHome');
        }
    };

    const handleAddExtraImage = async (camera: boolean) => {
        try {
            const result = camera
                ? await ImagePicker.launchCameraAsync({ quality: 0.5 })
                : await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });

            if (!result.canceled) {
                const optimized = await optimizeImage(result.assets[0].uri);
                setExtraImages([...extraImages, optimized]);
            }
        } catch (e) {
            console.warn('Image addition failed', e);
        }
    };

    return (
        <SafeAreaView style={appStyles.flexContainer}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={appStyles.flexContainer}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 40}
            >
                <AppHeader title="우편물 등록" onBack={handleBack} />
                {ocrLoading && (
                    <View style={{ position: 'absolute', zIndex: 99, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#4F46E5" />
                        <Text style={{ marginTop: 10, fontWeight: '700' }}>처리 중입니다...</Text>
                    </View>
                )}
                <ScrollView style={appStyles.container} contentContainerStyle={{ paddingBottom: 100 }}>
                    <SectionCard title="우편물 촬영">
                        {selectedImage ? (
                            <View>
                                <Image source={{ uri: selectedImage }} style={appStyles.previewImage} />
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <Pressable style={[appStyles.retakeBtn, { flex: 1 }]} onPress={async () => {
                                        const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
                                        if (!result.canceled) runOCR(result.assets[0].uri);
                                    }}>
                                        <Text style={appStyles.retakeBtnText}>📷 다시 촬영</Text>
                                    </Pressable>
                                    <Pressable style={[appStyles.retakeBtn, { flex: 1, backgroundColor: '#F1F5F9' }]} onPress={async () => {
                                        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
                                        if (!result.canceled) runOCR(result.assets[0].uri);
                                    }}>
                                        <Text style={[appStyles.retakeBtnText, { color: '#64748B' }]}>🖼️ 앨범 선택</Text>
                                    </Pressable>
                                </View>
                            </View>
                        ) : (
                            <View style={{ gap: 10 }}>
                                <PrimaryButton
                                    label="📷 우편물 사진 촬영"
                                    onPress={async () => {
                                        const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
                                        if (!result.canceled) runOCR(result.assets[0].uri);
                                    }}
                                />
                                <Pressable
                                    onPress={async () => {
                                        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
                                        if (!result.canceled) runOCR(result.assets[0].uri);
                                    }}
                                    style={{
                                        backgroundColor: '#F1F5F9',
                                        padding: 15,
                                        borderRadius: 12,
                                        alignItems: 'center',
                                        borderWidth: 1,
                                        borderColor: '#E2E8F0'
                                    }}
                                >
                                    <Text style={{ color: '#64748B', fontWeight: '700' }}>🖼️ 앨범에서 사진 가져오기</Text>
                                </Pressable>
                            </View>
                        )}
                        {ocrLoading && <ActivityIndicator style={{ marginTop: 20 }} color="#4F46E5" />}
                    </SectionCard>

                    {selectedImage && !ocrLoading && (
                        <>
                            <SectionCard title="인식 결과 및 대상 설정">
                                <View style={appStyles.inputGroup}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text style={appStyles.label}>받는 분 (입주사)</Text>
                                        <Pressable
                                            onPress={() => setIsManualSearchVisible(true)}
                                            style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                                        >
                                            <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600' }}>🔍 수동 검색</Text>
                                        </Pressable>
                                    </View>
                                    <View style={appStyles.profileSelector}>
                                        {matchedProfile ? (
                                            <View style={[appStyles.matchedBox, !matchedProfile.is_active && { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}>
                                                <View>
                                                    <Text style={[appStyles.matchedText, !matchedProfile.is_active && { color: '#B91C1C' }]}>
                                                        {!matchedProfile.is_active ? '🚫 ' : '✅ '}
                                                        {matchedProfile.name} {matchedProfile.room_number ? `(${matchedProfile.room_number})` : ''}
                                                        {matchedProfile.company_name ? ` - ${matchedProfile.company_name}` : ''}
                                                    </Text>
                                                    {!matchedProfile.is_active && (
                                                        <Text style={{ color: '#DC2626', fontSize: 12, fontWeight: '700', marginTop: 4 }}>
                                                            ⚠️ 퇴거된 입주사입니다
                                                        </Text>
                                                    )}
                                                </View>
                                                <Pressable onPress={() => setMatchedProfile(null)}>
                                                    <Text style={appStyles.changeText}>변경</Text>
                                                </Pressable>
                                            </View>
                                        ) : (
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={appStyles.profileList}>
                                                {profiles.map((p: any) => (
                                                    <Pressable
                                                        key={p.id}
                                                        style={[appStyles.profileChip, !p.is_active && { opacity: 0.5, backgroundColor: '#F3F4F6' }]}
                                                        onPress={() => setMatchedProfile(p)}
                                                    >
                                                        <Text style={[appStyles.profileChipText, !p.is_active && { color: '#9CA3AF' }]}>
                                                            {p.name} {p.room_number ? `(${p.room_number})` : ''} {!p.is_active && '(퇴거)'}
                                                        </Text>
                                                    </Pressable>
                                                ))}
                                            </ScrollView>
                                        )}
                                    </View>
                                </View>

                                <View style={appStyles.inputGroup}>
                                    <Text style={appStyles.label}>발신처 (보낸이)</Text>
                                    <TextInput
                                        style={appStyles.input}
                                        value={detectedSender}
                                        onChangeText={setDetectedSender}
                                        placeholder="보낸이를 확인해주세요"
                                    />
                                </View>

                                <View style={appStyles.inputGroup}>
                                    <Text style={appStyles.label}>우편 종류</Text>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={appStyles.typeList}>
                                        {['일반', '등기/중요', '세금/국세', '고지서/요금'].map(t => (
                                            <Pressable
                                                key={t}
                                                style={[appStyles.typeChip, detectedMailType === t && appStyles.typeChipActive]}
                                                onPress={() => setDetectedMailType(t as any)}
                                            >
                                                <Text style={[appStyles.typeChipText, detectedMailType === t && appStyles.typeChipTextActive]}>{t}</Text>
                                            </Pressable>
                                        ))}
                                    </ScrollView>
                                </View>
                            </SectionCard>

                            <SectionCard title="💬 알림 메시지 선택">
                                <Text style={[appStyles.label, { marginBottom: 12 }]}>빠른 메시지 선택</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                                    {presets.map(p => (
                                        <Pressable
                                            key={p}
                                            style={[
                                                appStyles.profileChip,
                                                { marginBottom: 0, marginRight: 10 },
                                                selectedPreset === p && { backgroundColor: '#4F46E5', borderColor: '#4F46E5' }
                                            ]}
                                            onPress={() => {
                                                if (selectedPreset === p) {
                                                    setSelectedPreset(null);
                                                } else {
                                                    setSelectedPreset(p);
                                                    setCustomMessage('');
                                                }
                                            }}
                                        >
                                            <Text style={[appStyles.profileChipText, selectedPreset === p && { color: '#fff' }]}>
                                                {p}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>

                                <Text style={appStyles.label}>직접 입력 (위 항목 미선택 시)</Text>
                                <TextInput
                                    style={[appStyles.input, selectedPreset && { opacity: 0.5, backgroundColor: '#F1F5F9' }]}
                                    value={customMessage}
                                    onChangeText={(t) => {
                                        setCustomMessage(t);
                                        if (t) setSelectedPreset(null);
                                    }}
                                    placeholder="입주사에게 보낼 추가 메시지..."
                                    editable={!selectedPreset}
                                />
                            </SectionCard>

                            {matchedProfile?.is_premium && (
                                <SectionCard title="✨ 프리미엄 서비스: 상세 촬영">
                                    <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 15 }}>
                                        입주사가 개봉/촬영 요청 대상입니다. 추가 페이지를 촬영하세요.
                                    </Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                        {extraImages.map((uri: string, idx: number) => (
                                            <View key={idx} style={{ position: 'relative' }}>
                                                <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }} />
                                                <Pressable
                                                    onPress={() => setExtraImages(extraImages.filter((_: any, i: number) => i !== idx))}
                                                    style={{ position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}
                                                >
                                                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>✕</Text>
                                                </Pressable>
                                            </View>
                                        ))}
                                        <Pressable
                                            onPress={() => {
                                                Alert.alert('이미지 추가', '어디서 사진을 가져올까요?', [
                                                    { text: '📷 촬영하기', onPress: () => handleAddExtraImage(true) },
                                                    { text: '🖼️ 앨범에서 선택', onPress: () => handleAddExtraImage(false) },
                                                    { text: '취소', style: 'cancel' }
                                                ]);
                                            }}
                                            style={{ width: 80, height: 80, borderRadius: 8, borderStyle: 'dotted', borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}
                                        >
                                            <Text style={{ color: '#94A3B8', fontSize: 24 }}>+</Text>
                                            <Text style={{ color: '#94A3B8', fontSize: 10 }}>이미지 추가</Text>
                                        </Pressable>
                                    </View>
                                </SectionCard>
                            )}

                            <View style={{ padding: 20, marginBottom: 40 }}>
                                <PrimaryButton
                                    label={
                                        !matchedProfile
                                            ? '입주사를 선택해주세요'
                                            : !matchedProfile.is_active
                                                ? '퇴거된 입주사입니다 (발송 불가)'
                                                : `${matchedProfile.name}님께 알림 보내기`
                                    }
                                    onPress={onSubmit}
                                    disabled={!matchedProfile || !matchedProfile.is_active}
                                />
                            </View>
                        </>
                    )}
                </ScrollView>

                {/* 수동 입주사 검색 모달 */}
                <Modal
                    visible={isManualSearchVisible}
                    animationType="slide"
                    transparent
                    onRequestClose={() => {
                        setIsManualSearchVisible(false);
                        setManualSearchQuery('');
                    }}
                >
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}
                    >
                        <View style={{ backgroundColor: '#fff', borderRadius: 20, maxHeight: '85%', overflow: 'hidden' }}>
                            <View style={{ padding: 15, borderBottomWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontSize: 18, fontWeight: '700' }}>입주사 검색</Text>
                                <Pressable onPress={() => {
                                    setIsManualSearchVisible(false);
                                    setManualSearchQuery('');
                                }} style={{ padding: 5 }}>
                                    <Text style={{ fontSize: 16 }}>✕</Text>
                                </Pressable>
                            </View>

                            <View style={{ padding: 15 }}>
                                <TextInput
                                    style={{ backgroundColor: '#F1F5F9', padding: 12, borderRadius: 10, fontSize: 15, borderWidth: 1, borderColor: '#E2E8F0' }}
                                    placeholder="입주사명, 담당자, 호실 검색..."
                                    value={manualSearchQuery}
                                    onChangeText={setManualSearchQuery}
                                    autoFocus
                                />
                            </View>

                            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
                                {profiles
                                    .filter((p: any) => {
                                        const query = manualSearchQuery.toLowerCase();
                                        return (
                                            p.name.toLowerCase().includes(query) ||
                                            (p.company_name?.toLowerCase() || '').includes(query) ||
                                            (p.room_number?.toLowerCase() || '').includes(query)
                                        );
                                    })
                                    .map((p: any) => (
                                        <Pressable
                                            key={p.id}
                                            style={{
                                                padding: 15,
                                                borderBottomWidth: 1,
                                                borderBottomColor: '#F1F5F9',
                                                backgroundColor: !p.is_active ? '#FEF2F2' : '#fff'
                                            }}
                                            onPress={() => {
                                                setMatchedProfile(p);
                                                setIsManualSearchVisible(false);
                                                setManualSearchQuery('');
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <View>
                                                    <Text style={{ fontSize: 16, fontWeight: '700', color: !p.is_active ? '#B91C1C' : '#1E293B' }}>
                                                        {p.name}
                                                    </Text>
                                                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                                                        {p.company_name ? `${p.company_name} | ` : ''} {p.room_number || '호실 미기재'} | {p.phone}
                                                    </Text>
                                                </View>
                                                {!p.is_active && (
                                                    <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#991B1B' }}>퇴거</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </Pressable>
                                    ))}
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                {/* 알림 결과 및 스마트 대체 발송 모달 */}
                <Modal
                    visible={resultModalVisible}
                    animationType="fade"
                    transparent
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                        <View style={{ backgroundColor: '#fff', width: '100%', borderRadius: 20, padding: 25, alignItems: 'center' }}>
                            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                                <Text style={{ fontSize: 30 }}>⚠️</Text>
                            </View>

                            <Text style={{ fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 10 }}>알림 전달 불가</Text>
                            <Text style={{ fontSize: 15, color: '#64748B', textAlign: 'center', lineHeight: 22, marginBottom: 25 }}>
                                입주사가 앱을 설치하지 않았거나{"\n"}알림을 꺼둔 상태입니다.{"\n"}
                                <Text style={{ fontWeight: '700', color: '#4F46E5' }}>문자(SMS)로 링크를 보내시겠습니까?</Text>
                            </Text>

                            <PrimaryButton
                                label="📱 문자로 링크 전송하기"
                                onPress={handleSmsFallback}
                                style={{ width: '100%', marginBottom: 12, backgroundColor: '#4F46E5', alignSelf: 'stretch', alignItems: 'center', paddingVertical: 15 }}
                                textStyle={{ fontSize: 16, fontWeight: '700' }}
                            />

                            {/* 테스트용 직접 열기 버튼 추가 */}
                            <Pressable
                                onPress={async () => {
                                    if (lastNotifResult?.shareLink) {
                                        let link = lastNotifResult.shareLink;
                                        if (Platform.OS === 'web') {
                                            const currentOrigin = window.location.origin;
                                            link = link.replace('https://postnoti-app-two.vercel.app', currentOrigin);
                                            window.location.href = link;
                                        } else {
                                            // 모바일에서는 앱 스키마를 우선 시도하여 더 강력하게 앱을 호출
                                            const nativeLink = link.replace('https://postnoti-app-two.vercel.app/', 'postnoti://');
                                            try {
                                                await Linking.openURL(nativeLink);
                                            } catch (e) {
                                                await Linking.openURL(link);
                                            }
                                        }
                                    }
                                }}
                                style={{
                                    width: '100%',
                                    paddingVertical: 12,
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: '#E2E8F0',
                                    alignItems: 'center',
                                    backgroundColor: '#F8FAFC',
                                    marginBottom: 20
                                }}
                            >
                                <Text style={{ color: '#444', fontWeight: '600' }}>🔍 링크 직접 열기 (테스트용)</Text>
                            </Pressable>

                            <Pressable
                                style={{ padding: 10 }}
                                onPress={handleSuccessFinish}
                            >
                                <Text style={{ color: '#94A3B8', fontWeight: '600' }}>나중에 하기</Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};
