import { useState } from 'react';
import { Alert } from 'react-native';
import { MailType, recognizeText, classifyMail, preprocessImage as ocrPreprocess } from '../services/ocrService';
import { Profile } from '../services/profilesService';

export const useOCR = (profiles: Profile[], masterSenders: string[]) => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [recognizedText, setRecognizedText] = useState('');
    const [detectedMailType, setDetectedMailType] = useState<MailType>('일반');
    const [detectedSender, setDetectedSender] = useState('');
    const [ocrLoading, setOcrLoading] = useState(false);
    const [extraImages, setExtraImages] = useState<string[]>([]);
    const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);

    const findMatch = (text: string, excludeSender?: string) => {
        const lines = text.split('\n').map(l => l.trim().toLowerCase());
        const candidates = profiles.map(p => {
            let score = 0;
            const name = p.name.toLowerCase();
            const compName = p.company_name?.toLowerCase() || '';
            const room = p.room_number?.toLowerCase() || '';

            lines.forEach(line => {
                if (excludeSender && line.includes(excludeSender.toLowerCase())) return;
                if (compName && line.includes(compName)) score += compName.length > 2 ? 15 : 8;
                if (line.includes(name)) {
                    score += 5;
                    if (room && line.includes(room)) score += 10;
                    if (line.includes(`${name} 귀하`) || line.includes(`${name}님`) || line.includes(`${name} 앞`)) score += 7;
                }
                if (room) {
                    const roomPattern = new RegExp(`(^|[^0-9])${room}([^0-9]|$)`);
                    if (roomPattern.test(line)) score += 5;
                }
            });
            return { profile: p, score };
        });

        const best = candidates.filter(c => c.score > 1).sort((a, b) => b.score - a.score)[0];
        return best ? best.profile : null;
    };

    const runOCR = async (uri: string) => {
        try {
            setOcrLoading(true);
            const processed = await ocrPreprocess(uri);
            // 업로드 안정성을 위해 최적화된 Base64 데이터를 상태에 저장
            setSelectedImage(processed.data);

            const result = await recognizeText(processed.uri, masterSenders);
            setRecognizedText(result.text);

            const type = classifyMail(result.text, result.sender);
            setDetectedMailType(type);

            const match = findMatch(result.text, result.sender);
            setMatchedProfile(match || null);

            const isKnownSender = masterSenders.some(s => result.sender.includes(s) || s.includes(result.sender));
            if (isKnownSender && result.sender) {
                let cleanSender = result.sender;
                if (match?.name) cleanSender = cleanSender.replace(match.name, '').trim();
                if (match?.company_name) cleanSender = cleanSender.replace(match.company_name, '').trim();
                setDetectedSender(cleanSender);
            } else {
                setDetectedSender('');
            }
        } catch (error) {
            console.error('OCR Error:', error);
            Alert.alert('오류', 'OCR 인식 중 문제가 발생했습니다.');
        } finally {
            setOcrLoading(false);
        }
    };

    const resetOCR = () => {
        setSelectedImage(null);
        setDetectedSender('');
        setMatchedProfile(null);
        setExtraImages([]);
        setRecognizedText('');
        setDetectedMailType('일반');
    };

    return {
        selectedImage, setSelectedImage,
        recognizedText, setRecognizedText,
        detectedMailType, setDetectedMailType,
        detectedSender, setDetectedSender,
        ocrLoading, setOcrLoading,
        extraImages, setExtraImages,
        matchedProfile, setMatchedProfile,
        runOCR,
        resetOCR
    };
};
