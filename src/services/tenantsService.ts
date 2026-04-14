import { supabase } from '../lib/supabase';

export interface Tenant {
    id: string;
    company_id: string;
    company_name?: string; // 법인/회사명
    name: string;          // 담당자 이름
    phone: string;
    room_number?: string;
    mailbox_code?: string;
    is_active: boolean;
    is_premium: boolean;
    profile_id?: string;   // 연결된 앱 계정 (선택)
    created_at?: string;
}

export const tenantsService = {
    async getTenantsByCompany(companyId: string) {
        const { data, error } = await supabase
            .from('tenants')
            .select('*')
            .eq('company_id', companyId)
            .order('name');
        if (error) throw error;
        return data as Tenant[];
    },

    async createTenant(tenant: Partial<Tenant>) {
        const { data, error } = await supabase
            .from('tenants')
            .insert([tenant])
            .select()
            .single();
        if (error) throw error;
        return data as Tenant;
    },

    async updateTenant(id: string, updates: Partial<Tenant>) {
        const { data, error } = await supabase
            .from('tenants')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as Tenant;
    },

    async deleteTenant(id: string) {
        const { error } = await supabase
            .from('tenants')
            .delete()
            .eq('id', id);
        if (error) throw error;
    },

    async findTenantByNameAndPhone(companyId: string, name: string, phoneSuffix: string) {
        // 정확한 필터링은 DB에서 name으로 1차 필터링 후 메모리에서 Suffix 비교
        const { data, error } = await supabase
            .from('tenants')
            .select('*')
            .eq('company_id', companyId)
            .eq('name', name)
            .eq('is_active', true);

        if (error) throw error;
        if (!data || data.length === 0) return null;

        const match = data.find(t => t.phone && t.phone.replace(/[^0-9]/g, '').endsWith(phoneSuffix));
        return match as Tenant || null;
    },

    async getTenantById(id: string) {
        const { data, error } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', id)
            .single();
        if (error) throw error;
        return data as Tenant;
    }
};
