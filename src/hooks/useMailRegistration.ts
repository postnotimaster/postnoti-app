import { Alert } from 'react-native';
import { mailService } from '../services/mailService';
import { storageService } from '../services/storageService';
import { Company } from '../services/companiesService';
import { Tenant } from '../services/tenantsService';
import { MailType } from '../services/ocrService';
import { notificationService, NotificationResult } from '../services/notificationService';

export const useMailRegistration = (
    officeInfo: Company | null,
    setMailLogs: (logs: any[]) => void,
    setOcrLoading: (loading: boolean) => void,
    resetOCR: () => void
) => {
    // runNotifications was moved to notificationService.ts

    const handleRegisterMail = async (
        matchedProfile: Tenant | null,
        selectedImage: string | null,
        detectedMailType: MailType,
        detectedSender: string,
        extraImages: string[],
        customMessage?: string
    ): Promise<NotificationResult | null> => {
        if (!officeInfo) {
            Alert.alert('오류', '지점 정보가 로드되지 않았습니다.');
            return null;
        }
        if (!matchedProfile) {
            Alert.alert('오류', '입주사가 선택되지 않았습니다.');
            return null;
        }
        if (!selectedImage) {
            Alert.alert('오류', '우편물 사진을 촬영해주세요.');
            return null;
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

            // 3. 알림 발송 및 결과 수집
            const notifResult = await notificationService.sendPushNotification(
                matchedProfile,
                officeInfo,
                detectedSender,
                detectedMailType,
                customMessage
            );

            // Alert.alert('완료', `${matchedProfile.name}님께 알림을 보냈습니다.`); // 이전 단순 알림 제거

            // 데이터 갱신
            const refreshedMails = await mailService.getMailsByCompany(officeInfo.id);
            setMailLogs(refreshedMails);

            // Reset UI States (Success) 제거 - UI 컴포넌트에서 제어하도록 변경
            // resetOCR(); 

            return notifResult;
        } catch (error: any) {
            console.error('Register mail error:', error);
            Alert.alert('오류', error.message || '등록 중 문제가 발생했습니다.');
            return null;
        } finally {
            setOcrLoading(false);
        }
    };

    return { handleRegisterMail };
};
