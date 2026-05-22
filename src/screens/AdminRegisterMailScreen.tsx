import React from 'react';
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, TextInput, Modal, Alert, Linking, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { notificationService, NotificationResult } from '../services/notificationService';
import { tenantsService } from '../services/tenantsService';
import * as ImagePicker from 'expo-image-picker';
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
    const [pushStatuses, setPushStatuses] = React.useState<Record<string, boolean>>({}); // [NEW] ?∏Ïãú ?ÅÌÉú ?ÑÌô©??

    const prevOcrLoading = React.useRef(ocrLoading);

    React.useEffect(() => {
        if (prevOcrLoading.current === true && ocrLoading === false) {
            if (matchedProfile) {
                const status = matchedProfile.status || (matchedProfile.is_active ? '?ÖÏ£º' : '?¥Í±∞');
                if (status !== '?ÖÏ£º') {
                    const compName = matchedProfile.company_name || '(ÎØ∏Îì±Î°?';
                    Alert.alert(
                        `?†Ô∏è Ï£ºÏùò: [${status}] ?ÅÌÉú ?ÖÏ£º??,
                        `ÏßÑÎã® ?Ä?? ${compName} / ${matchedProfile.name}\n???ÖÏ£º?¨Îäî ?ÑÏû¨ [${status}] ?ÅÌÉú?ÖÎãà??\n\n?§Î•∏ ?∞Ìé∏Î¨ºÏùÑ Ï∞çÏúº?úÍ≤†?µÎãàÍπ? ?ÑÎãàÎ©??¥Îãπ ?ÖÏ£º?¨Ïùò ?ïÎ≥¥ ?òÏù¥ÏßÄÎ°?Í∞Ä?úÍ≤†?µÎãàÍπ?`,
                        [
                            {
                                text: '?ì∑ ?§Ïãú Ï¥¨ÏòÅ',
                                onPress: async () => {
                                    const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
                                    if (!result.canceled) runOCR(result.assets[0].uri);
                                }
                            },
                            {
                                text: '?¥Îãπ ?ÖÏ£º???ïÎ≥¥ Î≥¥Í∏∞',
                                onPress: () => {
                                    resetOCR();
                                    setSelectedProfileForHistory(matchedProfile);
                                    setIsHistoryVisible(true);
                                    setMode('admin_dashboard');
                                }
                            },
                            {
                                text: 'Î¨¥Ïãú?òÍ≥† ?±Î°ù ÏßÑÌñâ',
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
        "Ï£ºÎ¨∏?òÏã† ?ùÎ∞∞Í∞Ä ?ÑÏ∞©?àÏäµ?àÎã§ ?ì¶",
        "Ï§ëÏöî ?±Í∏∞ ?∞Ìé∏???ÑÏ∞©?àÏäµ?àÎã§ ?âÔ∏è",
        "?ºÎ∞ò ?∞Ìé∏Î¨ºÏù¥ ?ÑÏ∞©?àÏäµ?àÎã§ ?ìÆ",
        "Î¨ºÌíà?Ä ?ÖÍµ¨ ?∞Ïä§?¨Ïóê???òÎ†π Í∞Ä?•Ìï©?àÎã§ ?íÅ",
        "?ùÎ∞∞?®Ïóê Î≥¥Í????êÏóà?µÎãà???îí"
    ]);

    React.useEffect(() => {
        if (officeInfo?.id) {
            // ?ÑÎ¶¨??Î°úÎìú Î∞??∏Ïãú ?ÅÌÉú ?ÑÏàò Ï°∞ÏÇ¨ Î≥ëÎ†¨ ?§Ìñâ
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
        try {
            const defaultMsg = officeInfo?.settings?.default_message || "?àÎÖï?òÏÑ∏?? ?∞Ìé∏Î¨ºÏù¥ ?ÑÏ∞©?àÏäµ?àÎã§.";
            const finalMessage = selectedPreset || customMessage || defaultMsg;
            
            const result = await handleRegisterMail(
                matchedProfile,
                selectedImage,
                '?ºÎ∞ò',
                '',
                extraImages,
                finalMessage
            );

            if (result) {
                setLastNotifResult(result);
                if (result.success || !fallbackToSms) {
                    showToast({ message: '?åÎ¶º???±Í≥µ?ÅÏúºÎ°??ÑÏÜ°?òÏóà?µÎãà???îî', type: 'success' });
                    handleSuccessFinish();
                } else {
                    handleSmsFallback(result);
                }
            }
        } catch (e: any) {
            console.error('[AdminRegisterMail] confirmSend error:', e);
            Alert.alert('?±Î°ù ?§Î•ò', `Î¨∏Ï†úÍ∞Ä Î∞úÏÉù?àÏäµ?àÎã§: ${e.message}`);
        }
    };

    const handleSuccessFinish = () => {
        setCustomMessage('');
        setSelectedPreset(null);
        setDropdownVisible(false);
        setResultModalVisible(false);
        if (resetOCR) resetOCR(); // ?îÎ©¥???òÍ∞à ??Ï¥àÍ∏∞??
        setMode('admin_dashboard');
    };

    const handleSmsFallback = async (result?: NotificationResult) => {
        const notifResult = result || lastNotifResult;
        if (!officeInfo) {
            showToast({ message: '?§Ìîº??ÏßÄ???ïÎ≥¥Í∞Ä ?ÜÏäµ?àÎã§.', type: 'error' });
            return;
        }
        if (!matchedProfile) {
            showToast({ message: '?ÖÏ£º???ïÎ≥¥Í∞Ä ?ÜÏäµ?àÎã§.', type: 'error' });
            return;
        }
        if (!notifResult) {
            showToast({ message: '?åÎ¶º ?ÑÏÜ° Í≤∞Í≥º ?∞Ïù¥?∞Í? ?ÜÏäµ?àÎã§.', type: 'error' });
            return;
        }

        const phone = notifResult.targetPhone || matchedProfile.phone;
        if (!phone) {
            showToast({ message: '?ÖÏ£º?¨Ïùò ?ÑÌôîÎ≤àÌò∏Í∞Ä ?ÜÏäµ?àÎã§.', type: 'error' });
            return;
        }

        let message = notificationService.getShareMessage(matchedProfile, officeInfo);
        if (Platform.OS === 'web') {
            const currentOrigin = window.location.origin;
            message = message.replace('https://postnoti-app.vercel.app', currentOrigin);
        }

        const separator = Platform.OS === 'ios' ? '&' : '?';
        const url = `sms:${phone}${separator}body=${encodeURIComponent(message)}`;

        try {
            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
            } else {
                await Linking.openURL(`sms:${phone}`);
            }
            handleSuccessFinish();
        } catch (e) {
            console.error('SMS open failed', e);
            showToast({ message: 'Î©îÏãúÏßÄ ?±ÏùÑ ?????ÜÏäµ?àÎã§.', type: 'error' });
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
                <AppHeader title="?∞Ìé∏Î¨??±Î°ù" onBack={handleBack} />
                {ocrLoading && (
                    <View style={{ position: 'absolute', zIndex: 99, top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.7)', justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#4F46E5" />
                        <Text style={{ marginTop: 10, fontWeight: '700' }}>Ï≤òÎ¶¨ Ï§ëÏûÖ?àÎã§...</Text>
                    </View>
                )}
                <ScrollView style={appStyles.container} contentContainerStyle={{ paddingBottom: 100 }}>
                    <SectionCard title="?∞Ìé∏Î¨?Ï¥¨ÏòÅ">
                        {selectedImage ? (
                            <View>
                                <Image source={{ uri: selectedImage }} style={appStyles.previewImage} />
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    <Pressable style={[appStyles.retakeBtn, { flex: 1 }]} onPress={async () => {
                                        const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
                                        if (!result.canceled) runOCR(result.assets[0].uri);
                                    }}>
                                        <Text style={appStyles.retakeBtnText}>?ì∑ ?§Ïãú Ï¥¨ÏòÅ</Text>
                                    </Pressable>
                                    <Pressable style={[appStyles.retakeBtn, { flex: 1, backgroundColor: '#F1F5F9' }]} onPress={async () => {
                                        const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
                                        if (!result.canceled) runOCR(result.assets[0].uri);
                                    }}>
                                        <Text style={[appStyles.retakeBtnText, { color: '#64748B' }]}>?ñºÔ∏??®Î≤î ?†ÌÉù</Text>
                                    </Pressable>
                                </View>
                            </View>
                        ) : (
                            <View style={{ gap: 10 }}>
                                <PrimaryButton
                                    label="?ì∑ ?∞Ìé∏Î¨??¨ÏßÑ Ï¥¨ÏòÅ"
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
                                    <Text style={{ color: '#64748B', fontWeight: '700' }}>?ñºÔ∏??®Î≤î?êÏÑú ?¨ÏßÑ Í∞Ä?∏Ïò§Í∏?/Text>
                                </Pressable>
                            </View>
                        )}
                        {ocrLoading && <ActivityIndicator style={{ marginTop: 20 }} color="#4F46E5" />}
                    </SectionCard>

                    {selectedImage && !ocrLoading && (
                        <>
                            <SectionCard title="?∏Ïãù Í≤∞Í≥º Î∞??Ä???§Ï†ï">
                                <View style={appStyles.inputGroup}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text style={appStyles.label}>Î∞õÎäî Î∂?(?ÖÏ£º??</Text>
                                        <Pressable
                                            onPress={() => setIsManualSearchVisible(true)}
                                            style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}
                                        >
                                            <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600' }}>?îç ?òÎèô Í≤Ä??/Text>
                                        </Pressable>
                                    </View>
                                    <View style={appStyles.profileSelector}>
                                        {matchedProfile ? (
                                            <View style={[appStyles.matchedBox, !matchedProfile.is_active && { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}>
                                                <View>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                        <Text style={[appStyles.matchedText, !matchedProfile.is_active && { color: '#B91C1C' }]}>
                                                            {!matchedProfile.is_active ? '?ö´ ' : '??'}
                                                            {matchedProfile.name} {matchedProfile.room_number ? `(${matchedProfile.room_number})` : ''}
                                                            {matchedProfile.company_name ? ` - ${matchedProfile.company_name}` : ''}
                                                        </Text>
                                                        {/* [Í∞úÏÑ†] ?òÏù¥???úÍ±∞ ???´ÏûêÎßåÏúºÎ°??∏Ïãú ?ÅÌÉú ?êÎ≥Ñ */}
                                                        {(() => {
                                                            const normPhone = matchedProfile.phone ? matchedProfile.phone.replace(/[^0-9]/g, '') : '';
                                                            const isApp = matchedProfile.profile_id || (normPhone && pushStatuses[normPhone]);
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
                                                            ?†Ô∏è ?¥Í±∞???ÖÏ£º?¨ÏûÖ?àÎã§
                                                        </Text>
                                                    )}
                                                </View>
                                                <Pressable onPress={() => setMatchedProfile(null)}>
                                                    <Text style={appStyles.changeText}>Î≥ÄÍ≤?/Text>
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
                                                            {p.name} {p.room_number ? `(${p.room_number})` : ''} {!p.is_active && '(?¥Í±∞)'}
                                                        </Text>
                                                    </Pressable>
                                                ))}
                                            </ScrollView>
                                        )}
                                    </View>
                                </View>
                                {/* Î∞úÏã†Ï≤?Î∞??∞Ìé∏ Ï¢ÖÎ•ò ?πÏÖò ??†ú??*/}
                            </SectionCard>

                            <SectionCard title="?í¨ ?åÎ¶º Î©îÏãúÏßÄ ?†ÌÉù">
                                <View style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 15 }}>
                                    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700', marginBottom: 4 }}>?ìã Í∏∞Î≥∏ ?åÎ¶º Î©îÏãúÏßÄ (ÎØ∏ÏÑ†????Î∞úÏÜ°)</Text>
                                    <Text style={{ fontSize: 13, color: '#475569', fontWeight: '600' }}>
                                        "{officeInfo?.settings?.default_message || "?àÎÖï?òÏÑ∏?? ?∞Ìé∏Î¨ºÏù¥ ?ÑÏ∞©?àÏäµ?àÎã§."}"
                                    </Text>
                                </View>

                                <Text style={[appStyles.label, { marginBottom: 8 }]}>Îπ†Î•∏ Î©îÏãúÏßÄ ?†ÌÉù</Text>
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
                                            {selectedPreset || '?åÎ¶º Î©îÏãúÏßÄÎ•??†ÌÉù?òÏÑ∏??..'}
                                        </Text>
                                        <Text style={{ color: '#64748B', fontSize: 12 }}>??/Text>
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
                                            <Text style={{ color: '#94A3B8', fontWeight: '800', fontSize: 16 }}>??/Text>
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

                                <Text style={appStyles.label}>ÏßÅÏ†ë ?ÖÎ†• (?†ÌÉù??Î©îÏãúÏßÄ ?Ä???¨Ïö©??</Text>
                                <TextInput
                                    style={[appStyles.input, selectedPreset && { opacity: 0.5, backgroundColor: '#F1F5F9' }]}
                                    value={customMessage}
                                    onChangeText={(t) => {
                                        setCustomMessage(t);
                                        if (t) setSelectedPreset(null);
                                    }}
                                    placeholder="?ÖÏ£º?¨ÏóêÍ≤?Î≥¥ÎÇº Ï∂îÍ? Î©îÏãúÏßÄ..."
                                    editable={!selectedPreset}
                                />
                            </SectionCard>

                            {matchedProfile?.is_premium && (
                                <SectionCard title="???ÑÎ¶¨ÎØ∏ÏóÑ ?úÎπÑ?? ?ÅÏÑ∏ Ï¥¨ÏòÅ">
                                    <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 15 }}>
                                        ?ÖÏ£º?¨Í? Í∞úÎ¥â/Ï¥¨ÏòÅ ?îÏ≤≠ ?Ä?ÅÏûÖ?àÎã§. Ï∂îÍ? ?òÏù¥ÏßÄÎ•?Ï¥¨ÏòÅ?òÏÑ∏??
                                    </Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                        {extraImages.map((uri: string, idx: number) => (
                                            <View key={idx} style={{ position: 'relative' }}>
                                                <Image source={{ uri }} style={{ width: 80, height: 80, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }} />
                                                <Pressable
                                                    onPress={() => setExtraImages(extraImages.filter((_: any, i: number) => i !== idx))}
                                                    style={{ position: 'absolute', top: -5, right: -5, backgroundColor: '#EF4444', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}
                                                >
                                                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '900' }}>??/Text>
                                                </Pressable>
                                            </View>
                                        ))}
                                        <Pressable
                                            onPress={() => {
                                                Alert.alert('?¥Î?ÏßÄ Ï∂îÍ?', '?¥Îîî???¨ÏßÑ??Í∞Ä?∏Ïò¨ÍπåÏöî?', [
                                                    { text: '?ì∑ Ï¥¨ÏòÅ?òÍ∏∞', onPress: () => handleAddExtraImage(true) },
                                                    { text: '?ñºÔ∏??®Î≤î?êÏÑú ?†ÌÉù', onPress: () => handleAddExtraImage(false) },
                                                    { text: 'Ï∑®ÏÜå', style: 'cancel' }
                                                ]);
                                            }}
                                            style={{ width: 80, height: 80, borderRadius: 8, borderStyle: 'dotted', borderWidth: 2, borderColor: '#CBD5E1', justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}
                                        >
                                            <Text style={{ color: '#94A3B8', fontSize: 24 }}>+</Text>
                                            <Text style={{ color: '#94A3B8', fontSize: 10 }}>?¥Î?ÏßÄ Ï∂îÍ?</Text>
                                        </Pressable>
                                    </View>
                                </SectionCard>
                            )}

                            <View style={{ padding: 20, marginBottom: 40 }}>
                                <PrimaryButton
                                    label={
                                        !matchedProfile
                                            ? '?ÖÏ£º?¨Î? ?†ÌÉù?¥Ï£º?∏Ïöî'
                                            : !matchedProfile.is_active
                                                ? '?¥Í±∞???ÖÏ£º?¨ÏûÖ?àÎã§ (Î∞úÏÜ° Î∂àÍ?)'
                                                : `${matchedProfile.name}?òÍªò ?åÎ¶º Î≥¥ÎÇ¥Í∏?
                                    }
                                    onPress={onSubmit}
                                    disabled={!matchedProfile || !matchedProfile.is_active}
                                />
                            </View>
                        </>
                    )}
                </ScrollView>

                {/* ?òÎèô ?ÖÏ£º??Í≤Ä??Î™®Îã¨ */}
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
                                <Text style={{ fontSize: 18, fontWeight: '700' }}>?ÖÏ£º??Í≤Ä??/Text>
                                <Pressable onPress={() => {
                                    setIsManualSearchVisible(false);
                                    setManualSearchQuery('');
                                }} style={{ padding: 5 }}>
                                    <Text style={{ fontSize: 16 }}>??/Text>
                                </Pressable>
                            </View>

                            <View style={{ padding: 15 }}>
                                <TextInput
                                    style={{ backgroundColor: '#F1F5F9', padding: 12, borderRadius: 10, fontSize: 15, borderWidth: 1, borderColor: '#E2E8F0' }}
                                    placeholder="?ÖÏ£º?¨Î™Ö, ?¥Îãπ?? ?∏Ïã§ Í≤Ä??.."
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
                                                        {p.company_name ? `${p.company_name} | ` : ''} {p.room_number || '?∏Ïã§ ÎØ∏Í∏∞??} | {p.phone}
                                                    </Text>
                                                </View>
                                                {!p.is_active && (
                                                    <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                                                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#991B1B' }}>?¥Í±∞</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </Pressable>
                                    ))}
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </Modal>

                {/* ?åÎ¶º Í≤∞Í≥º Î∞??§Îßà???ÄÏ≤?Î∞úÏÜ° Î™®Îã¨ */}
                <Modal
                    visible={resultModalVisible}
                    animationType="fade"
                    transparent
                    onRequestClose={() => setResultModalVisible(false)}
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                        <View style={{ backgroundColor: '#fff', width: '100%', borderRadius: 20, padding: 25, alignItems: 'center' }}>
                            {matchedProfile && (
                                matchedProfile.profile_id || 
                                (matchedProfile.phone && pushStatuses[matchedProfile.phone.replace(/[^0-9]/g, '')])
                            ) ? (
                                <>
                                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                                        <Text style={{ fontSize: 30 }}>?ì±</Text>
                                    </View>
                                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 10 }}>???§Ïπò ?ÖÏ£º??/Text>
                                    <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 25 }}>
                                        ?¥Îãπ ?ÖÏ£º?¨Îäî ?±Ïù¥ ?§Ïπò???ÅÌÉú?ÖÎãà??{"\n"}
                                        ?êÌïò?úÎäî ?åÎ¶º Î∞úÏÜ° Î∞©Ïãù???†ÌÉù??Ï£ºÏÑ∏??
                                    </Text>
                                    <PrimaryButton
                                        label="?? Î∞îÎ°ú Î≥¥ÎÇ¥Í∏?(???∏Ïãú)"
                                        onPress={() => confirmAndSend(false)}
                                        style={{ width: '100%', marginBottom: 10, backgroundColor: '#16A34A', alignSelf: 'stretch', alignItems: 'center', paddingVertical: 15 }}
                                        textStyle={{ fontSize: 16, fontWeight: '700' }}
                                    />
                                    <PrimaryButton
                                        label="?ì± Î¨∏ÏûêÎ°?ÎßÅÌÅ¨ ?ÑÏÜ°?òÍ∏∞"
                                        onPress={() => confirmAndSend(true)}
                                        style={{ width: '100%', marginBottom: 12, backgroundColor: '#4F46E5', alignSelf: 'stretch', alignItems: 'center', paddingVertical: 15 }}
                                        textStyle={{ fontSize: 16, fontWeight: '700' }}
                                    />
                                </>
                            ) : (
                                <>
                                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                                        <Text style={{ fontSize: 30 }}>?†Ô∏è</Text>
                                    </View>
                                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 10 }}>??ÎØ∏ÏÑ§Ïπ??ÖÏ£º??/Text>
                                    <Text style={{ fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 25 }}>
                                        ?¥Îãπ ?ÖÏ£º?¨Îäî ?ÑÏßÅ ?±ÏùÑ ?§Ïπò?òÏ? ?äÏïò?µÎãà??{"\n"}
                                        Î¨∏ÏûêÎ°??∞Ìé∏Î¨??ïÏù∏ ÎßÅÌÅ¨Î•??ÑÏÜ°??Ï£ºÏÑ∏??
                                    </Text>
                                    <PrimaryButton
                                        label="?ì± Î¨∏ÏûêÎ°?ÎßÅÌÅ¨ ?ÑÏÜ°?òÍ∏∞"
                                        onPress={() => confirmAndSend(true)}
                                        style={{ width: '100%', marginBottom: 10, backgroundColor: '#4F46E5', alignSelf: 'stretch', alignItems: 'center', paddingVertical: 15 }}
                                        textStyle={{ fontSize: 16, fontWeight: '700' }}
                                    />
                                    <Pressable
                                        onPress={() => confirmAndSend(false)}
                                        style={{ 
                                            width: '100%', 
                                            paddingVertical: 12, 
                                            borderRadius: 12, 
                                            borderWidth: 1, 
                                            borderColor: '#E2E8F0', 
                                            alignItems: 'center', 
                                            backgroundColor: '#F8FAFC',
                                            marginBottom: 10
                                        }}
                                    >
                                        <Text style={{ color: '#64748B', fontWeight: '600' }}>?? Í∑∏Îûò?????∏Ïãú Î∞úÏÜ° ?úÎèÑ</Text>
                                    </Pressable>
                                </>
                            )}

                            <Pressable
                                style={{ padding: 10 }}
                                onPress={() => setResultModalVisible(false)}
                            >
                                <Text style={{ color: '#94A3B8', fontWeight: '600' }}>Ï∑®ÏÜå</Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};
