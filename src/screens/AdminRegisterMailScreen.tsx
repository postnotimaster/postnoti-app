import React from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, TextInput, Modal, Alert, Linking, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { notificationService, NotificationResult } from '../services/notificationService';
import { tenantsService } from '../services/tenantsService';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useAuth } from '../contexts/AuthContext';
import { useUI } from '../contexts/UIContext';
import { useOCRContext } from '../contexts/OCRContext';
import { useToast } from '../contexts/ToastContext';
import { appStyles } from '../styles/appStyles';
import { AppHeader } from '../components/common/AppHeader';
import { SectionCard } from '../components/common/SectionCard';
import { PrimaryButton } from '../components/common/PrimaryButton';

export const AdminRegisterMailScreen = () => {
    const { showToast } = useToast();
    const { officeInfo, profiles } = useAuth();
    const {
        mode,
        setMode,
        isHistoryVisible,
        setIsHistoryVisible,
        isManualSearchVisible,
        setIsManualSearchVisible,
        manualSearchQuery,
        setManualSearchQuery,
        setSelectedProfileForHistory
    } = useUI();
    const {
        selectedImage,
        setSelectedImage,
        ocrLoading,
        runOCR,
        matchedProfile,
        setMatchedProfile,
        detectedSender,
        setDetectedSender,
        detectedMailType,
        setDetectedMailType,
        extraImages,
        setExtraImages,
        handleRegisterMail,
        resetOCR,
        optimizeImage
    } = useOCRContext();

    const [customMessage, setCustomMessage] = React.useState('');
    const [selectedPreset, setSelectedPreset] = React.useState<string | null>(null);
    const [dropdownVisible, setDropdownVisible] = React.useState(false);
    const [resultModalVisible, setResultModalVisible] = React.useState(false);
    const [lastNotifResult, setLastNotifResult] = React.useState<NotificationResult | null>(null);
    const [pushStatuses, setPushStatuses] = React.useState<Record<string, boolean>>({}); // [NEW] 푸시 상태 현황판
    const [isSending, setIsSending] = React.useState(false);

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
                                    setMode('admin_dashboard');
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
    }, [ocrLoading, matchedProfile, runOCR, resetOCR, setSelectedProfileForHistory, setIsHistoryVisible, setMode]);

    const [presets, setPresets] = React.useState<string[]>([
        "주문하신 택배가 도착했습니다 📦",
        "중요 등기 우편이 도착했습니다 ✉️",
        "일반 우편물이 도착했습니다 📮",
        "물품은 입구 데스크에서 수령 가능합니다 💁",
        "택배함에 보관해 두었습니다 🔒"
    ]);

    React.useEffect(() => {
        if (officeInfo?.id) {
            // 프리셋 로드 및 푸시 상태 전수 조사 병렬 실행
            if (officeInfo.settings?.notification_presets) {
                setPresets(officeInfo.settings.notification_presets);
            }
            tenantsService.getCompanyPushStatuses(officeInfo.id).then(setPushStatuses);
        }
    }, [officeInfo]);

    const onSubmit = () => {
        if (!matchedProfile) return;
        setResultModalVisible(true);
    };

    const confirmAndSend = async (fallbackToSms: boolean) => {
        if (isSending) return;
        setIsSending(true);
        try {
            const defaultMsg = officeInfo?.settings?.default_message || "안녕하세요. 우편물이 도착했습니다.";
            const finalMessage = selectedPreset || customMessage || defaultMsg;
            
            const result = await handleRegisterMail(
                matchedProfile,
                selectedImage,
                '일반',
                '',
                extraImages,
                finalMessage
            );

            if (result) {
                setLastNotifResult(result);
                
                if (fallbackToSms) {
                    // 명시적으로 문자 전송을 누른 경우 -> 바로 문자 앱 실행
                    handleSmsFallback(result);
                } else if (result.success) {
                    // 앱 푸시 성공
                    showToast({ message: '알림이 성공적으로 전송되었습니다 🔔', type: 'success' });
                    handleSuccessFinish();
                } else {
                    // 앱 푸시 실패 (등록된 토큰 없음 등) -> 경고 후 문자로 전환
                    Alert.alert(
                        '푸시 알림 전송 불가',
                        '입주사가 앱을 설치하지 않았거나 알림이 꺼져 있어 푸시를 보낼 수 없습니다. 문자 전송으로 전환합니다.',
                        [
                            {
                                text: '확인',
                                onPress: () => handleSmsFallback(result)
                            }
                        ]
                    );
                }
            }
        } catch (e: any) {
            console.error('[AdminRegisterMail] confirmSend error:', e);
            Alert.alert('등록 오류', `문제가 발생했습니다: ${e.message}`);
        } finally {
            setIsSending(false);
        }
    };

    const handleSuccessFinish = () => {
        setCustomMessage('');
        setSelectedPreset(null);
        setDropdownVisible(false);
        setResultModalVisible(false);
        if (resetOCR) resetOCR(); // 화면을 나갈 때 초기화
        setMode('admin_dashboard');
    };

    const handleSmsFallback = async (result?: NotificationResult) => {
        const notifResult = result || lastNotifResult;
        if (!officeInfo) {
            showToast({ message: '오피스 지점 정보가 없습니다.', type: 'error' });
            return;
        }
        if (!matchedProfile) {
            showToast({ message: '입주사 정보가 없습니다.', type: 'error' });
            return;
        }
        if (!notifResult) {
            showToast({ message: '알림 전송 결과 데이터가 없습니다.', type: 'error' });
            return;
        }

        const phone = notifResult.targetPhone || matchedProfile.phone;
        if (!phone) {
            showToast({ message: '입주사의 전화번호가 없습니다.', type: 'error' });
            return;
        }

        let message = notificationService.getShareMessage(matchedProfile, officeInfo);
        if (Platform.OS === 'web') {
            const currentOrigin = window.location.origin;
            message = message.replace('https://postn.kr', currentOrigin);
        }

        const separator = Platform.OS === 'ios' ? '&' : '?';
        const url = `sms:${phone}${separator}body=${encodeURIComponent(message)}`;

        try {
            if (Platform.OS === 'web') {
                // 웹(PC/모바일 웹) 환경에서는 팝업 차단을 우회하고 안전하게 복사까지 지원
                try {
                    await Clipboard.setStringAsync(message);
                    showToast({ message: '메시지가 클립보드에 복사되었습니다. (PC 환경 대비)', type: 'success' });
                } catch (e) {
                    console.log('Clipboard copy failed');
                }
                
                // 모바일 PWA에서는 sms: 링크가 작동하도록 a 태그 클릭 시뮬레이션 또는 href 변경
                window.location.href = url;
            } else {
                // 네이티브 앱 (관리자용 안드로이드/iOS)
                // 안드로이드 11+ 에서는 intent queries 선언 없이 canOpenURL 호출 시 무조건 false가 반환되므로,
                // 검사 없이 바로 openURL을 실행하여 내용(body)이 포함된 문자를 엽니다.
                await Linking.openURL(url);
            }
            
            // 모달을 바로 닫으면 PWA/앱에서 sms 링크로 전환되기 전에 앱이 멈출 수 있으므로 약간의 지연
            setTimeout(() => {
                handleSuccessFinish();
            }, 500);
            
        } catch (e) {
            console.error('SMS open failed', e);
            showToast({ message: '메시지 앱을 열 수 없습니다. 텍스트를 복사하여 전송해주세요.', type: 'error' });
            // 네이티브에서도 실패 시 복사해줌
            try {
                await Clipboard.setStringAsync(message);
            } catch (clipboardErr) {}
            
            handleSuccessFinish();
        }
    };

    const handleBack = () => {
        setMode('admin_dashboard');
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
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <Text style={[appStyles.matchedText, !matchedProfile.is_active && { color: '#B91C1C' }]}>
                                                            {!matchedProfile.is_active ? '🚫 ' : '✅ '}
                                                            {matchedProfile.name} {matchedProfile.room_number ? `(${matchedProfile.room_number})` : ''}
                                                            {matchedProfile.company_name ? ` - ${matchedProfile.company_name}` : ''}
                                                        </Text>
                                                        {/* 프리미엄 뱃지 */}
                                                        {matchedProfile.is_premium && (
                                                            <View style={{
                                                                backgroundColor: '#FFD700', // 골드빛 배경
                                                                paddingHorizontal: 7,
                                                                paddingVertical: 3,
                                                                borderRadius: 5,
                                                                borderWidth: 1,
                                                                borderColor: '#F59E0B', // 진한 노란색/주황색 테두리
                                                                alignItems: 'center'
                                                            }}>
                                                                <Text style={{ fontSize: 9, color: '#78350F', fontWeight: '900', letterSpacing: 0.8 }}>프리미엄</Text>
                                                            </View>
                                                        )}
                                                        {/* [개선] 하이픈 제거 후 숫자만으로 푸시 상태 판별 */}
                                                        {(() => {
                                                            const normPhone = matchedProfile.phone ? matchedProfile.phone.replace(/[^0-9]/g, '') : '';
                                                            const isApp = !!(normPhone && pushStatuses[normPhone]);
                                                            return (
                                                                <View style={{ 
                                                                    backgroundColor: isApp ? '#DBEAFE' : '#F1F5F9', 
                                                                    paddingHorizontal: 6, 
                                                                    paddingVertical: 2, 
                                                                    borderRadius: 6 
                                                                }}>
                                                                    <Text style={{ fontSize: 9, fontWeight: '900', color: isApp ? '#2563EB' : '#94A3B8' }}>
                                                                        {isApp ? 'APP' : 'SMS'}
                                                                    </Text>
                                                                </View>
                                                            );
                                                        })()}
                                                    </View>
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
                                            <View style={{ alignItems: 'center', paddingVertical: 25, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' }}>
                                                <Text style={{ fontSize: 28, marginBottom: 8 }}>⚠️</Text>
                                                <Text style={{ color: '#1E293B', fontSize: 16, fontWeight: '800', marginBottom: 6 }}>
                                                    대상을 찾지 못했습니다
                                                </Text>
                                                <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 20, textAlign: 'center', paddingHorizontal: 20 }}>
                                                    사진을 다시 찍거나 직접 검색해주세요.
                                                </Text>
                                                
                                                <View style={{ flexDirection: 'row', gap: 10, width: '100%', paddingHorizontal: 20 }}>
                                                    <Pressable 
                                                        onPress={async () => {
                                                            const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
                                                            if (!result.canceled) runOCR(result.assets[0].uri);
                                                        }} 
                                                        style={{ flex: 1, backgroundColor: '#EEF2FF', padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#C7D2FE' }}
                                                    >
                                                        <Text style={{ color: '#4F46E5', fontWeight: '700', fontSize: 14 }}>📷 다시 촬영</Text>
                                                    </Pressable>
                                                    <Pressable 
                                                        onPress={() => setIsManualSearchVisible(true)}
                                                        style={{ flex: 1, backgroundColor: '#4F46E5', padding: 12, borderRadius: 10, alignItems: 'center' }}
                                                    >
                                                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>🔍 이름/호수 검색</Text>
                                                    </Pressable>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                {/* 발신처 및 우편 종류 섹션 삭제됨 */}
                            </SectionCard>

                            <SectionCard title="💬 알림 메시지 선택">
                                <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 15 }}>
                                    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700', marginBottom: 4 }}>📋 기본 알림 메시지 (미선택 시 발송)</Text>
                                    <Text style={{ fontSize: 13, color: '#475569', fontWeight: '600' }}>
                                        "{officeInfo?.settings?.default_message || "안녕하세요. 우편물이 도착했습니다."}"
                                    </Text>
                                </View>

                                <Text style={[appStyles.label, { marginBottom: 8 }]}>빠른 메시지 선택</Text>
                                <View style={{ position: 'relative', marginBottom: 10 }}>
                                    <Pressable
                                        onPress={() => setDropdownVisible(!dropdownVisible)}
                                        style={{
                                            flexDirection: 'row',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            backgroundColor: '#F8FAFC',
                                            borderWidth: 1,
                                            borderColor: '#E2E8F0',
                                            borderRadius: 12,
                                            paddingHorizontal: 15,
                                            height: 50,
                                        }}
                                    >
                                        <Text style={{ fontSize: 15, color: selectedPreset ? '#1E293B' : '#94A3B8', flex: 1, marginRight: 30 }} numberOfLines={1}>
                                            {selectedPreset || '알림 메시지를 선택하세요...'}
                                        </Text>
                                        <Text style={{ color: '#64748B', fontSize: 12 }}>▼</Text>
                                    </Pressable>
                                    {selectedPreset && (
                                        <Pressable 
                                            onPress={() => setSelectedPreset(null)} 
                                            style={{ 
                                                position: 'absolute', 
                                                right: 35, 
                                                top: 0, 
                                                bottom: 0, 
                                                justifyContent: 'center', 
                                                paddingHorizontal: 10 
                                            }}
                                        >
                                            <Text style={{ color: '#94A3B8', fontWeight: '800', fontSize: 16 }}>✕</Text>
                                        </Pressable>
                                    )}
                                </View>

                                {dropdownVisible && (
                                    <View style={{
                                        backgroundColor: '#fff',
                                        borderWidth: 1,
                                        borderColor: '#E2E8F0',
                                        borderRadius: 12,
                                        overflow: 'hidden',
                                        marginBottom: 15,
                                        elevation: 2,
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: 2 },
                                        shadowOpacity: 0.05,
                                        shadowRadius: 4
                                    }}>
                                        {presets.map((p, idx) => (
                                            <Pressable
                                                key={p}
                                                onPress={() => {
                                                    setSelectedPreset(p);
                                                    setCustomMessage('');
                                                    setDropdownVisible(false);
                                                }}
                                                style={{
                                                    paddingVertical: 14,
                                                    paddingHorizontal: 15,
                                                    borderBottomWidth: idx === presets.length - 1 ? 0 : 1,
                                                    borderBottomColor: '#F1F5F9',
                                                    backgroundColor: selectedPreset === p ? '#F1F5F9' : '#fff'
                                                }}
                                            >
                                                <Text style={{
                                                    fontSize: 14,
                                                    color: selectedPreset === p ? '#4F46E5' : '#1E293B',
                                                    fontWeight: selectedPreset === p ? '700' : '500'
                                                }}>
                                                    {p}
                                                </Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                )}

                                <Text style={appStyles.label}>직접 입력 (선택한 메시지 대신 사용됨)</Text>
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
                    onRequestClose={() => setResultModalVisible(false)}
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                        <View style={{ backgroundColor: '#fff', width: '100%', borderRadius: 20, padding: 25, alignItems: 'center' }}>
                            {matchedProfile && (
                                matchedProfile.phone && pushStatuses[matchedProfile.phone.replace(/[^0-9]/g, '')]
                            ) ? (
                                <>
                                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                                        <Text style={{ fontSize: 30 }}>📱</Text>
                                    </View>
                                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 10 }}>앱 설치 입주사</Text>
                                    <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 25 }}>
                                        해당 입주사는 앱이 설치된 상태입니다.{"\n"}
                                        원하시는 알림 발송 방식을 선택해 주세요.
                                    </Text>
                                    <PrimaryButton
                                        label={isSending ? "데이터 저장 중..." : "🚀 바로 보내기 (앱 푸시)"}
                                        onPress={() => confirmAndSend(false)}
                                        loading={isSending}
                                        disabled={isSending}
                                        style={{ width: '100%', marginBottom: 10, backgroundColor: '#16A34A', alignSelf: 'stretch', alignItems: 'center', paddingVertical: 15 }}
                                        textStyle={{ fontSize: 16, fontWeight: '700' }}
                                    />
                                    <PrimaryButton
                                        label={isSending ? "사진 업로드 중..." : "📱 문자로 링크 전송하기"}
                                        onPress={() => confirmAndSend(true)}
                                        loading={isSending}
                                        disabled={isSending}
                                        style={{ width: '100%', marginBottom: 12, backgroundColor: '#4F46E5', alignSelf: 'stretch', alignItems: 'center', paddingVertical: 15 }}
                                        textStyle={{ fontSize: 16, fontWeight: '700' }}
                                    />
                                </>
                            ) : (
                                <>
                                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                                        <Text style={{ fontSize: 30 }}>⚠️</Text>
                                    </View>
                                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 10 }}>앱 미설치 입주사</Text>
                                    <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 25 }}>
                                        해당 입주사는 아직 앱을 설치하지 않았습니다.{"\n"}
                                        문자로 우편물 확인 링크를 전송해 주세요.
                                    </Text>
                                    <PrimaryButton
                                        label={isSending ? "처리 중..." : "📱 문자로 링크 전송하기"}
                                        onPress={() => confirmAndSend(true)}
                                        loading={isSending}
                                        disabled={isSending}
                                        style={{ width: '100%', marginBottom: 10, backgroundColor: '#4F46E5', alignSelf: 'stretch', alignItems: 'center', paddingVertical: 15 }}
                                        textStyle={{ fontSize: 16, fontWeight: '700' }}
                                    />
                                    <Pressable
                                        onPress={() => confirmAndSend(false)}
                                        disabled={isSending}
                                        style={{ 
                                            width: '100%', 
                                            paddingVertical: 12, 
                                            borderRadius: 12, 
                                            borderWidth: 1, 
                                            borderColor: '#E2E8F0', 
                                            alignItems: 'center', 
                                            backgroundColor: '#F8FAFC',
                                            marginBottom: 10,
                                            opacity: isSending ? 0.5 : 1
                                        }}
                                    >
                                        <Text style={{ color: '#64748B', fontWeight: '600' }}>{isSending ? "로딩 중..." : "🚀 그래도 앱 푸시 발송 시도"}</Text>
                                    </Pressable>
                                </>
                            )}

                            <Pressable
                                style={{ padding: 10 }}
                                onPress={() => setResultModalVisible(false)}
                            >
                                <Text style={{ color: '#94A3B8', fontWeight: '600' }}>취소</Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};
