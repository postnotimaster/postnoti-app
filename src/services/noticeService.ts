import { supabase } from '../lib/supabase';

export interface Announcement {
    id: string;
    company_id: string;
    title: string;
    content: string;
    created_at: string;
    updated_at: string;
    is_active: boolean;
    priority: number;
    target_tenant_ids: string[] | null;
}

export const noticeService = {
    async getAnnouncements(companyId: string) {
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Announcement[];
    },

    async getAnnouncementsForTenant(companyId: string, tenantId: string) {
        // target_tenant_ids가 NULL이거나 tenantId를 포함하는 것만 조회
        // Supabase에서 array contains를 쓰거나 rpc를 쓰는 것이 편함.
        // 여기선 간단히 전체 조회 후 필터링하거나, .or()를 사용
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .or(`target_tenant_ids.is.null,target_tenant_ids.cs.{${tenantId}}`)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Announcement[];
    },

    async getAllAnnouncements(companyId: string) {
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data as Announcement[];
    },

    async createAnnouncement(notice: Partial<Announcement>) {
        const { data, error } = await supabase
            .from('announcements')
            .insert([notice])
            .select()
            .single();
        if (error) throw error;
        return data as Announcement;
    },

    async updateAnnouncement(id: string, updates: Partial<Announcement>) {
        const { data, error } = await supabase
            .from('announcements')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as Announcement;
    },

    async deleteAnnouncement(id: string) {
        const { error } = await supabase
            .from('announcements')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};
