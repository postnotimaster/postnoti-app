import { supabase } from '../lib/supabase';

export const storageService = {
    /**
     * Uploads a local file URI to Supabase Storage and returns the public URL.
     * Uses 'mail_images' bucket by default.
     * @param uri Local file URI (e.g. file://...)
     * @returns Public URL of the uploaded file
     */
    async uploadImage(uri: string): Promise<string | null> {
        if (!uri) return null;
        if (uri.startsWith('http')) return uri; // 이미 업로드된 주소인 경우

        try {
            console.log('🚀 업로드 프로세스 시작 (Native Stable Mode)');

            let arrayBuffer: ArrayBuffer;
            let contentType = 'image/jpeg';
            let fileExt = 'jpg';

            // 1. 데이터 준비 (Base64 -> ArrayBuffer 변환이 네이티브에서 가장 안정적)
            if (uri.startsWith('data:')) {
                const parts = uri.split(',');
                const base64 = parts[1];
                contentType = parts[0].split(':')[1].split(';')[0];
                fileExt = contentType.split('/')[1] || 'jpg';

                // Base64 to ArrayBuffer 변환 (네이티브 표준 방식)
                const binaryString = atob(base64);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                arrayBuffer = bytes.buffer;
            } else {
                // 일반 URI의 경우 fetch 시도 (보조 수단)
                const response = await fetch(uri);
                arrayBuffer = await response.arrayBuffer();
                fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
                contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
            }

            const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            console.log(`📤 Supabase 전송 중: ${fileName} (${arrayBuffer.byteLength} bytes)`);

            // 2. Supabase 업로드
            const { error: uploadError } = await supabase.storage
                .from('mail_images')
                .upload(fileName, arrayBuffer, {
                    contentType: contentType,
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) {
                console.error('❌ 업로드 상세 에러:', uploadError);
                // 에러 객체를 문자열화하여 더 자세히 파악
                const errStr = JSON.stringify(uploadError);
                const { Alert: RNAlert } = require('react-native');
                RNAlert.alert('업로드 실패', `서버 응답: ${errStr}`);
                throw uploadError;
            }

            const { data } = supabase.storage
                .from('mail_images')
                .getPublicUrl(fileName);

            console.log('✅ 업로드 성공:', data.publicUrl);
            return data.publicUrl;
        } catch (error) {
            console.error('❌ 최종 업로드 실패:', error);
            return null;
        }
    }
};
