import { supabase } from '../lib/supabase';

export const mailService = {
    async registerMail(
        companyId: string,
        profileId: string,
        mailType: string,
        ocrText: string,
        imageUri: string,
        extraImages: string[] = []
    ) {
        const { data, error } = await supabase
            .from('mail_logs')
            .insert([
                {
                    company_id: companyId,
                    profile_id: profileId,
                    mail_type: mailType,
                    ocr_content: ocrText,
                    image_url: imageUri,
                    extra_images: extraImages,
                    status: 'sent'
                }
            ]);
        return { data, error };
    },

    async getMailsByProfile(profileId: string) {
        const { data, error } = await supabase
            .from('mail_logs')
            .select('*')
            .eq('profile_id', profileId)
            .order('created_at', { ascending: false })
            .limit(100);
        if (error) throw error;
        return data || [];
    },

    async getMailsByCompany(companyId: string) {
        const { data, error } = await supabase
            .from('mail_logs')
            .select('*, profiles(id, name, room_number, company_name, phone, role, is_active)')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(50); // 최근 50개만 로드하여 성능 최적화
        if (error) throw error;
        return data || [];
    },

    async markAsRead(mailId: string) {
        const { data, error } = await supabase
            .from('mail_logs')
            .update({ read_at: new Date().toISOString() })
            .eq('id', mailId)
            .select();
        return { data, error };
    }
};
