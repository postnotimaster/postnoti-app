import { supabase } from '../lib/supabase';

export type Company = {
    id: string;
    name: string;
    address?: string;
    slug: string;
    business_number?: string;
    tenant_limit?: number;
    mail_quota?: number;
    current_usage?: number;
};

export const companiesService = {
    async getCompanies() {
        const { data, error } = await supabase
            .from('companies')
            .select('*');
        if (error) throw error;
        return data as Company[];
    },

    async checkSlugUnique(slug: string) {
        const { data, error } = await supabase
            .from('companies')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();
        if (error) throw error;
        return !data; // data가 없으면 unique
    },

    async createCompany(name: string, address: string, slug: string, business_number?: string) {
        const { data, error } = await supabase
            .from('companies')
            .insert([{ name, address, slug, business_number }])
            .select()
            .single();
        if (error) throw error;
        return data as Company;
    },

    async updateCompany(id: string, updates: Partial<Company>) {
        const { data, error } = await supabase
            .from('companies')
            .update(updates)
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as Company;
    },

    async deleteCompany(id: string) {
        const { error } = await supabase
            .from('companies')
            .delete()
            .eq('id', id);
        if (error) throw error;
    }
};
