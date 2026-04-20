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
            console.log('🚀 업로드 프로세스 시작 (Native FormData Mode)');

            let fileData: any;
            let fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            let contentType = 'image/jpeg';

            // 1. 데이터 준비
            if (uri.startsWith('data:')) {
                // Base64인 경우 ArrayBuffer로 변환 (기존 유지)
                const parts = uri.split(',');
                const base64 = parts[1];
                contentType = parts[0].split(':')[1].split(';')[0];
                const fileExt = contentType.split('/')[1] || 'jpg';
                fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

                const { Buffer } = require('buffer');
                const buffer = Buffer.from(base64, 'base64');
                const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
                fileData = bytes.buffer;
            } else {
                // 일반 URI(file://)인 경우 ImageManipulator로 Base64를 추출한 뒤 ArrayBuffer로 변환
                // React Native의 fetch(uri).blob()은 환경에 따라 Network request failed를 유발할 수 있음
                const { manipulateAsync, SaveFormat } = require('expo-image-manipulator');
                const result = await manipulateAsync(uri, [], { base64: true, format: SaveFormat.JPEG });

                if (!result.base64) throw new Error('이미지 데이터를 읽을 수 없습니다.');

                const { Buffer } = require('buffer');
                const buffer = Buffer.from(result.base64, 'base64');
                fileData = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

                const fileExt = uri.split('.').pop()?.toLowerCase() || 'jpg';
                contentType = `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`;
            }

            console.log(`📤 Supabase 전송 중: ${fileName}`);

            // 2. Supabase 업로드
            // FormData 방식을 지원하기 위해 fileData를 그대로 전달
            const { error: uploadError } = await supabase.storage
                .from('mail_images')
                .upload(fileName, fileData as any, {
                    contentType: contentType,
                    cacheControl: '3600',
                    upsert: true
                });

            if (uploadError) {
                console.error('❌ 업로드 상세 에러:', uploadError);
                // RLS 에러인 경우 사용자에게 구체적인 안내
                if (uploadError.message?.includes('row-level security')) {
                    throw new Error('보안 정책(RLS) 문제로 업로드가 차단되었습니다. SQL v3 스크립트를 다시 확인해주세요.');
                }
                throw uploadError;
            }

            const { data } = supabase.storage
                .from('mail_images')
                .getPublicUrl(fileName);

            console.log('✅ 업로드 성공:', data.publicUrl);
            return data.publicUrl;
        } catch (error: any) {
            console.error('❌ 최종 업로드 실패:', error);
            const { Alert: RNAlert } = require('react-native');
            RNAlert.alert('업로드 실패', error.message || '알 수 없는 오류가 발생했습니다.');
            return null;
        }
    }
};
