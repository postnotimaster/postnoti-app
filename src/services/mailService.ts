import { supabase } from '../lib/supabase';

export const mailService = {
    async registerMail(
        companyId: string,
        tenantId: string,
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
                    tenant_id: tenantId,
                    mail_type: mailType,
                    ocr_content: ocrText,
                    image_url: imageUri,
                    extra_images: extraImages,
                    status: 'sent'
                }
            ]);
        return { data, error };
    },

    async getMailsByTenant(tenantId: string) {
        // 기존의 RLS 제약을 우회하면서도 보안을 보장하는 RPC 함수 사용
        const { data, error } = await supabase.rpc('get_mails_by_tenant_secure', {
            p_tenant_id: tenantId
        });
        if (error) {
            console.error('getMailsByTenant RPC error:', error);
            throw error;
        }
        return data || [];
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
            .select('*, tenants(id, name, room_number, phone, company_name, is_active)')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(50);
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
