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
        // 보안 강화를 위해 RLS 우회 RPC 사용 (이름과 전화번호 뒷자리가 일치하는 건만 조회)
        const { data, error } = await supabase.rpc('find_tenant_by_name_and_phone_secure', {
            p_company_id: companyId,
            p_name: name,
            p_phone_suffix: phoneSuffix
        });

        if (error) {
            console.error('findTenantByNameAndPhone RPC error:', error);
            throw error;
        }

        if (!data || data.length === 0) return null;
        return data[0] as Tenant;
    },

    async getTenantById(id: string) {
        // 보안 강화를 위해 RLS 우회 RPC 사용 (정확한 UUID 매칭)
        const { data, error } = await supabase.rpc('get_tenant_by_id_secure', {
            p_tenant_id: id
        });

        if (error) {
            console.error('getTenantById RPC error:', error);
            throw error;
        }

        if (!data || data.length === 0) return null;
        return data[0] as Tenant;
    },

    // 입주사별 우편물 통계 조회 (전체수, 읽음수, 최근발송일)
    async getMailStatsByCompany(companyId: string): Promise<Record<string, { total: number; read: number; lastSentAt: string | null }>> {
        const { data, error } = await supabase
            .from('mail_logs')
            .select('tenant_id, read_at, created_at')
            .eq('company_id', companyId);

        if (error) throw error;

        const stats: Record<string, { total: number; read: number; lastSentAt: string | null }> = {};
        for (const row of (data || [])) {
            const tid = row.tenant_id;
            if (!tid) continue;
            if (!stats[tid]) stats[tid] = { total: 0, read: 0, lastSentAt: null };
            stats[tid].total++;
            if (row.read_at) stats[tid].read++;
            if (!stats[tid].lastSentAt || row.created_at > stats[tid].lastSentAt!) {
                stats[tid].lastSentAt = row.created_at;
            }
        }
        return stats;
    }
};
