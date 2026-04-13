import React from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, TextInput, Modal, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { useAppContent } from '../contexts/AppContext';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { SectionCard } from '../components/common/SectionCard';
import { PrimaryButton } from '../components/common/PrimaryButton';

export const AdminRegisterMailScreen = () => {
    const navigation = useNavigation<any>();
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
        optimizeImage
    } = useAppContent() as any;

    const [customMessage, setCustomMessage] = React.useState('');
    const [selectedPreset, setSelectedPreset] = React.useState<string | null>(null);

    const presets = [
        "주문하신 택배가 도착했습니다 📦",
        "중요 등기 우편이 도착했습니다 ✉️",
        "일반 우편물이 도착했습니다 📮",
        "물품은 입구 데스크에서 수령 가능합니다 💁",
        "택배함에 보관해 두었습니다 🔒"
    ];

    // Handler to wrap logic + navigation
    const onSubmit = async () => {
        const finalMessage = selectedPreset || customMessage || undefined;
        const success = await handleRegisterMail(
            matchedProfile,
            selectedImage,
            detectedMailType,
            detectedSender,
            extraImages,
            finalMessage
        );
        if (success) {
            setCustomMessage('');
            setSelectedPreset(null);
            navigation.navigate('AdminDashboard');
        }
    };

    const handleBack = () => {
        if (navigation.canGoBack()) {
            navigation.goBack();
        } else {
            navigation.navigate('AdminDashboard');
        }
    };

    const handleAddExtraImage = async (camera: boolean) => {
        try {
            const result = camera
                ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
                : await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });

            if (!result.canceled) {
                const optimized = await optimizeImage(result.assets[0].uri);
                setExtraImages([...extraImages, optimized]);
            }
        } catch (e) {
            console.warn('Image addition failed', e);
        }
    };

    return (
        <View style={appStyles.flexContainer}>
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
                                    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
                                    if (!result.canceled) runOCR(result.assets[0].uri);
                                }}>
                                    <Text style={appStyles.retakeBtnText}>📷 다시 촬영</Text>
                                </Pressable>
                                <Pressable style={[appStyles.retakeBtn, { flex: 1, backgroundColor: '#F1F5F9' }]} onPress={async () => {
                                    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
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
                                    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
                                    if (!result.canceled) runOCR(result.assets[0].uri);
                                }}
                            />
                            <Pressable
                                onPress={async () => {
                                    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
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
                                                    {matchedProfile.name} ({matchedProfile.room_number})
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
                                                        {p.name} {!p.is_active && '(퇴거)'}
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

                {/* 수동 입주사 검색 모달 (화면 내부 포함) */}
                <Modal
                    visible={isManualSearchVisible}
                    animationType="slide"
                    transparent
                    onRequestClose={() => {
                        setIsManualSearchVisible(false);
                        setManualSearchQuery('');
                    }}
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
                        <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%' }}>
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
                                    style={{ backgroundColor: '#F1F5F9', padding: 12, borderRadius: 10, fontSize: 14, marginBottom: 15 }}
                                    placeholder="입주사명, 호실 검색..."
                                    value={manualSearchQuery}
                                    onChangeText={setManualSearchQuery}
                                    autoFocus
                                />
                            </View>

                            <ScrollView style={{ maxHeight: 400 }}>
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
                                                        {p.company_name || '회사명 없음'} | {p.room_number || '호실 미기재'}
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
                    </View>
                </Modal>
            </ScrollView>
        </View>
    );
};
