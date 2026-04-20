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
        console.log(`[noticeService] getAnnouncements for Company: ${companyId}`);
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('priority', { ascending: false })
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[noticeService] getAnnouncements error:', error);
            throw error;
        }
        return (data as Announcement[]) || [];
    },

    async getAnnouncementsForTenant(companyId: string, tenantId: string) {
        console.log(`[noticeService] getAnnouncementsForTenant for Company: ${companyId}, Tenant: ${tenantId}`);

        if (!tenantId) {
            return this.getAnnouncements(companyId);
        }

        try {
            // target_tenant_ids가 NULL이거나 tenantId를 포함하는 것만 조회
            const { data, error } = await supabase
                .from('announcements')
                .select('*')
                .eq('company_id', companyId)
                .eq('is_active', true)
                .or(`target_tenant_ids.is.null,target_tenant_ids.cs.{${tenantId}}`)
                .order('priority', { ascending: false })
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[noticeService] getAnnouncementsForTenant error:', error);
                // Fallback: 쿼리 오류 시 전체 공지만이라도 반환
                const all = await this.getAnnouncements(companyId);
                return all.filter(a => !a.target_tenant_ids || a.target_tenant_ids.length === 0);
            }
            return (data as Announcement[]) || [];
        } catch (err) {
            console.error('[noticeService] getAnnouncementsForTenant exception:', err);
            return [];
        }
    },

    async getAllAnnouncements(companyId: string) {
        const { data, error } = await supabase
            .from('announcements')
            .select('*')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return (data as Announcement[]) || [];
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
