import { useState } from 'react';
import { Alert } from 'react-native';
import { MailType, recognizeText, classifyMail, preprocessImage as ocrPreprocess } from '../services/ocrService';
import { Tenant } from '../services/tenantsService';
import { useToast } from '../contexts/ToastContext';

export const useOCR = (profiles: Tenant[], masterSenders: string[]) => {
    const { showToast } = useToast();
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [recognizedText, setRecognizedText] = useState('');
    const [detectedMailType, setDetectedMailType] = useState<MailType>('일반');
    const [detectedSender, setDetectedSender] = useState('');
    const [ocrLoading, setOcrLoading] = useState(false);
    const [extraImages, setExtraImages] = useState<string[]>([]);
    const [matchedProfile, setMatchedProfile] = useState<Tenant | null>(null);

    // 문자열 유사도 측정 (간이 퍼지 매칭)
    const getSimilarity = (str1: string, str2: string) => {
        if (str1 === str2) return 1;
        if (str1.includes(str2) || str2.includes(str1)) return 0.8;

        // 2글자 이상 겹치는지 확인 (Bigram 유사성)
        let matches = 0;
        for (let i = 0; i < str1.length - 1; i++) {
            const gram = str1.substring(i, i + 2);
            if (str2.includes(gram)) matches++;
        }
        return matches / Math.max(str1.length, str2.length);
    };

    const findMatch = (text: string, excludeSender?: string) => {
        const lines = text.split('\n').map(l => l.trim().toLowerCase().replace(/[^a-z0-9가-힣\s]/g, ''));
        const candidates = profiles.map(p => {
            let score = 0;
            const name = p.name ? p.name.toLowerCase() : '';
            const compName = p.company_name ? p.company_name.toLowerCase() : '';
            const room = p.room_number ? p.room_number.toLowerCase() : '';

            lines.forEach(line => {
                if (!line) return;
                if (excludeSender && line.includes(excludeSender.toLowerCase())) return;

                // 회사명 매칭 (가장 높은 가중치)
                if (compName && compName.length > 1) {
                    if (line.includes(compName)) score += 25;
                    else if (getSimilarity(line, compName) > 0.4) score += 12;
                }

                // 이름 매칭 (한글 2글자 이상 권장)
                if (name && name.length >= 2) {
                    if (line.includes(name)) {
                        score += 20;
                        // 이름 + 귀하/님/앞/좌하 유무 확인
                        if (/(귀하|님|앞|좌하|선생님|대표님|담당자)/.test(line)) score += 15;
                    } else if (getSimilarity(line, name) > 0.5) {
                        score += 10;
                    }
                }

                // 호실 매칭
                if (room) {
                    const roomDigits = room.replace(/[^0-9]/g, '');
                    if (roomDigits && roomDigits.length >= 2 && line.includes(roomDigits)) {
                        score += 15;
                    }
                }
            });
            return { profile: p, score };
        });

        // 점수 기준 하향 (15 -> 12) 및 정렬
        const filtered = candidates.filter(c => c.score >= 12).sort((a, b) => b.score - a.score);
        console.log('🧐 Match Candidates Top 3:', filtered.slice(0, 3).map(f => `${f.profile.name}(${f.score})`));
        return filtered.length > 0 ? filtered[0].profile : null;
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
            showToast({ message: 'OCR 인식 중 문제가 발생했습니다.', type: 'error' });
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
