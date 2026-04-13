import { supabase } from '../lib/supabase';

export interface Profile {
    id?: string;
    company_id: string;
    company_name?: string; // 입주사명
    name: string;          // 담당자 이름
    phone: string;
    room_number?: string;
    role: 'admin' | 'tenant';
    is_active: boolean;
    is_premium?: boolean; // 프리미엄 회원 여부 (우편물 개봉/추가 촬영 대상)
    last_login_at?: string;
    push_token?: string;       // Native App Push Token
    web_push_token?: string;   // PWA Web Push Token
    mailbox_code?: string;     // [NEW] 사서함 번호 등
    pwa_installed?: boolean;   // PWA Install Status
    last_accessed_at?: string;
}

export const profilesService = {
    async getProfilesByCompany(companyId: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('company_id', companyId)
            .eq('role', 'tenant')
            .order('name');
        if (error) throw error;
        return data || [];
    },

    async createProfile(profile: Profile) {
        const { data, error } = await supabase
            .from('profiles')
            .insert([profile])
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async bulkRegister(profiles: Profile[]) {
        const { error } = await supabase
            .from('profiles')
            .insert(profiles);
        return error;
    },

    async getProfileByPhone(phone: string) {
        const { data, error } = await supabase
            .from('profiles')
            .select('*, companies(*)')
            .eq('phone', phone)
            .single();
        if (error) throw error;
        return data;
    },

    async getTenantProfile(companyId: string, name: string, phoneSuffix: string) {
        // 해당 지점의 입주자 중 이름이 일치하는 데이터들을 먼저 가져옴
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('company_id', companyId)
            .eq('name', name)
            .eq('role', 'tenant');

        if (error) throw error;
        if (!data || data.length === 0) return null;

        // 가져온 데이터 중 전화번호 뒷자리가 일치하는 것 찾기
        const match = data.find(p => p.phone && p.phone.replace(/[^0-9]/g, '').endsWith(phoneSuffix));
        return match || null;
    },

    async updateProfile(id: string, updates: Partial<Profile>) {
        const { data, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data;
    },

    async deleteProfile(id: string) {
        const { error } = await supabase
            .from('profiles')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};
