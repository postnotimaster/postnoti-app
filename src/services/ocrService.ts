import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';

export type MailType = '일반' | '세금/국세' | '공단/보험' | '과태료/경고' | '고지서/요금' | '등기/중요';

const SENDER_KEYWORDS = [
    '구청', '시청', '세무서', '국세청', '법원', '경찰청', '우체국', '은행',
    '카드', '보험', '증권', '공사', '공단', '교육청', '주식회사', '(주)', 'CS', '센터'
];

const IGNORE_PATTERNS = [
    /[0-9]{5}/,
    /[0-9]{2,3}-[0-9]{3,4}-[0-9]{4}/,
    /^[0-9A-Z\(\)\-\s\.]+$/
];

export const preprocessImage = async (uri: string, includeBase64: boolean = true) => {
    try {
        // [용량 vs 품질 밸런스] 1200px로 상향하여 인식률 확보, 품질 0.7로 조정
        const result = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1200 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: includeBase64 }
        );

        const base64Data = includeBase64 ? `data:image/jpeg;base64,${result.base64}` : null;
        console.log(`📸 OCR용 이미지 최적화 완료 (1200px): ${result.uri}`);

        return {
            uri: result.uri,
            data: base64Data
        };
    } catch (e) {
        console.warn('Image optimization failed:', e);
        return { uri, data: null };
    }
};

const extractSender = (lines: string[], masterSenders: string[] = []): string => {
    for (const line of lines) {
        const cleanLine = line.trim();
        const match = masterSenders.find(s => cleanLine.includes(s));
        if (match) return match;
    }
    for (const line of lines) {
        const cleanLine = line.trim();
        if (SENDER_KEYWORDS.some(kw => cleanLine.includes(kw))) {
            if (cleanLine.length > 3 && cleanLine.length < 30) {
                return cleanLine;
            }
        }
    }
    for (let i = 0; i < Math.min(lines.length, 5); i++) {
        const line = lines[i].trim();
        if (line.length > 3 && !IGNORE_PATTERNS.some(p => p.test(line))) {
            return line;
        }
    }
    return '';
};

export const classifyMail = (text: string, sender: string = ''): MailType => {
    const combined = (text + ' ' + sender).toUpperCase();
    if (combined.includes('세금') || combined.includes('국세') || combined.includes('TAX')) return '세금/국세';
    if (combined.includes('보험') || combined.includes('공단') || combined.includes('PENSION')) return '공단/보험';
    if (combined.includes('독촉') || combined.includes('경고') || combined.includes('과태료') || combined.includes('POLICE')) return '과태료/경고';
    if (combined.includes('요금') || combined.includes('명세서') || combined.includes('고지서') || combined.includes('BILL')) return '고지서/요금';
    if (combined.includes('등기') || combined.includes('REGISTERED')) return '등기/중요';
    return '일반';
};

export const recognizeText = async (uri: string, masterSenders: string[] = []) => {
    // Web 환경을 제외한 Native 환경(iOS/Android)에서 활성화
    if (Platform.OS === 'web') return { text: '', sender: '' };
    try {
        const result = await TextRecognition.recognize(uri, TextRecognitionScript.KOREAN);
        console.log('🔍 OCR Raw Text:', result.text);
        const lines = result.text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        const sender = extractSender(lines, masterSenders);
        console.log('🎯 Detected Sender:', sender);
        return { text: result.text, sender: sender };
    } catch (error) {
        console.warn('OCR processing failed:', error);
        return { text: '', sender: '' };
    }
};
