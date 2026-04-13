import { Alert } from 'react-native';
import { mailService } from '../services/mailService';
import { storageService } from '../services/storageService';
import { Company } from '../services/companiesService';
import { Profile } from '../services/profilesService';
import { MailType } from '../services/ocrService';

export const useMailRegistration = (
    officeInfo: Company | null,
    setMailLogs: (logs: any[]) => void,
    setOcrLoading: (loading: boolean) => void,
    resetOCR: () => void
) => {
    const runNotifications = async (profile: Profile, company: Company, sender: string, type: string, customMessage?: string) => {
        const title = `[${company.name}] 우편물 도착 📮`;
        const body = customMessage || `${sender ? `${sender}에서 보낸 ` : ''}${type} 우편물이 도착했습니다.`;

        // Native Push (Expo)
        if (profile.push_token) {
            fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: profile.push_token,
                    sound: 'default',
                    title,
                    body,
                    data: { url: `postnoti://branch/${company.slug}` }
                })
            }).catch(e => console.warn('Expo push failed', e));
        }

        // Web Push (Firebase)
        if (profile.web_push_token) {
            fetch('https://postnoti-app.vercel.app/api/send-push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: profile.web_push_token,
                    title,
                    body,
                    data: {
                        company_id: company.id,
                        url: `https://postnoti-app.vercel.app/branch/${company.slug}`
                    }
                })
            }).catch(e => console.warn('Web push failed', e));
        }
    };

    const handleRegisterMail = async (
        matchedProfile: Profile | null,
        selectedImage: string | null,
        detectedMailType: MailType,
        detectedSender: string,
        extraImages: string[],
        customMessage?: string
    ) => {
        if (!officeInfo) {
            Alert.alert('오류', '지점 정보가 로드되지 않았습니다.');
            return;
        }
        if (!matchedProfile) {
            Alert.alert('오류', '입주사가 선택되지 않았습니다.');
            return;
        }
        if (!selectedImage) {
            Alert.alert('오류', '우편물 사진을 촬영해주세요.');
            return;
        }

        try {
            setOcrLoading(true);

            // 1. 이미지를 Supabase Storage에 업로드
            const uploadedMainImage = await storageService.uploadImage(selectedImage);

            if (!uploadedMainImage) {
                throw new Error('사진 업로드에 실패했습니다.');
            }

            // 2. 추가 이미지들도 업로드
            const uploadedExtraImages: string[] = [];
            if (extraImages && extraImages.length > 0) {
                for (const img of extraImages) {
                    try {
                        const url = await storageService.uploadImage(img);
                        if (url) uploadedExtraImages.push(url);
                    } catch (e) {
                        console.warn('Failed to upload extra image:', e);
                    }
                }
            }

            const { error: regError } = await mailService.registerMail(
                officeInfo.id,
                matchedProfile.id!,
                detectedMailType,
                detectedSender,
                uploadedMainImage,
                uploadedExtraImages
            );

            if (regError) {
                console.error('DB Insert Error:', regError);
                throw new Error(`데이터 저장 실패: ${regError.message}`);
            }

            // Background notification task
            runNotifications(matchedProfile, officeInfo, detectedSender, detectedMailType, customMessage);

            Alert.alert('완료', `${matchedProfile.name}님께 알림을 보냈습니다.`);

            // 데이터 갱신
            const refreshedMails = await mailService.getMailsByCompany(officeInfo.id);
            setMailLogs(refreshedMails);

            // Reset UI States (Success)
            resetOCR();

            return true;
        } catch (error: any) {
            console.error('Register mail error:', error);
            Alert.alert('오류', error.message || '등록 중 문제가 발생했습니다.');
            return false;
        } finally {
            setOcrLoading(false);
        }
    };

    return { handleRegisterMail };
};
