import { supabase } from '../lib/supabase';

const PAGE_SIZE = 30;

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
            .select('*, tenants(id, name, room_number, phone, company_name, is_active, is_premium, profile_id)')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) throw error;
        return data || [];
    },

    /**
     * 관리자 대시보드용 페이지네이션 조회
     * @param companyId 오피스 ID
     * @param page 페이지 번호 (0부터 시작)
     * @returns { data, hasMore }
     */
    async getMailsByCompanyPaginated(companyId: string, page: number = 0) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
            .from('mail_logs')
            .select('*, tenants(id, name, room_number, phone, company_name, is_active, is_premium, profile_id)')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) throw error;

        return {
            data: data || [],
            hasMore: (data?.length || 0) >= PAGE_SIZE
        };
    },

    /**
     * 입주사(Tenant) 대시보드용 페이지네이션 조회
     * @param tenantId 입주사 ID
     * @param page 페이지 번호 (0부터 시작)
     * @returns { data, hasMore }
     */
    async getMailsByTenantPaginated(tenantId: string, page: number = 0) {
        const from = page * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        const { data, error } = await supabase
            .from('mail_logs')
            .select('*')
            .eq('tenant_id', tenantId)
            .order('created_at', { ascending: false })
            .range(from, to);

        if (error) {
            console.error('getMailsByTenantPaginated error:', error);
            throw error;
        }

        return {
            data: data || [],
            hasMore: (data?.length || 0) >= PAGE_SIZE
        };
    },

    async markAsRead(mailId: string) {
        const { data, error } = await supabase
            .from('mail_logs')
            .update({ read_at: new Date().toISOString() })
            .eq('id', mailId)
            .is('read_at', null)
            .select();
        if (error) {
            console.error('markAsRead error:', error);
        }
        return { data, error };
    }
};
