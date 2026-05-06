import React, { createContext, useContext, ReactNode } from 'react';
import { useOCR } from '../hooks/useOCR';
import { useMailRegistration } from '../hooks/useMailRegistration';
import { useAuth } from './AuthContext';
import { MailType } from '../services/ocrService';
import { Tenant } from '../services/tenantsService';
import { preprocessImage as ocrPreprocess } from '../services/ocrService';

interface OCRContextType {
    selectedImage: string | null;
    setSelectedImage: (uri: string | null) => void;
    ocrLoading: boolean;
    recognizedText: string;
    detectedMailType: MailType;
    setDetectedMailType: (t: MailType) => void;
    detectedSender: string;
    setDetectedSender: (s: string) => void;
    matchedProfile: Tenant | null;
    setMatchedProfile: (p: Tenant | null) => void;
    extraImages: string[];
    setExtraImages: (imgs: string[]) => void;
    runOCR: (uri: string) => Promise<void>;
    resetOCR: () => void;
    handleRegisterMail: (
        tenant: Tenant | null,
        image: string | null,
        type: MailType,
        sender: string,
        extras: string[],
        customMsg?: string
    ) => Promise<any>;
    optimizeImage: (uri: string) => Promise<string>;
}

const OCRContext = createContext<OCRContextType | undefined>(undefined);

export const OCRProvider = ({ children }: { children: ReactNode }) => {
    const { profiles, officeInfo } = useAuth();
    
    // 마스터 발신처 리스트는 나중에 NotificationContext나 별도 설정에서 가져오거나 
    // 임시로 [] 전달 (AppContext에서 나중에 발신처도 쪼갤 예정)
    const {
        selectedImage, setSelectedImage,
        recognizedText,
        detectedMailType, setDetectedMailType,
        detectedSender, setDetectedSender,
        ocrLoading, setOcrLoading,
        extraImages, setExtraImages,
        matchedProfile, setMatchedProfile,
        runOCR,
        resetOCR
    } = useOCR(profiles, []);

    const { handleRegisterMail: registerMailLogic } = useMailRegistration(
        officeInfo,
        null,
        setOcrLoading,
        resetOCR
    );

    const handleRegisterMail = async (
        tenant: Tenant | null,
        image: string | null,
        type: MailType,
        sender: string,
        extras: string[],
        customMsg?: string
    ) => {
        return await registerMailLogic(tenant, image, type, sender, extras, customMsg);
    };

    const optimizeImage = async (uri: string) => {
        const res = await ocrPreprocess(uri);
        return res.uri;
    };

    return (
        <OCRContext.Provider value={{
            selectedImage, setSelectedImage,
            recognizedText,
            detectedMailType, setDetectedMailType,
            detectedSender, setDetectedSender,
            ocrLoading,
            matchedProfile, setMatchedProfile,
            extraImages, setExtraImages,
            runOCR,
            resetOCR,
            handleRegisterMail,
            optimizeImage
        }}>
            {children}
        </OCRContext.Provider>
    );
};

export const useOCRContext = () => {
    const context = useContext(OCRContext);
    if (!context) throw new Error('useOCRContext must be used within an OCRProvider');
    return context;
};
