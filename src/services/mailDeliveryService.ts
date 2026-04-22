import { supabase } from '../lib/supabase';
import { Company } from './companiesService';

export type MailDeliveryRequest = {
    id: string;
    company_id: string;
    profile_id: string;
    recipient_name: string;
    recipient_phone: string;
    postcode: string;
    address: string;
    address_detail?: string;
    status: 'pending' | 'received' | 'shipped';
    created_at: string;
    updated_at: string;
    // 조인된 데이터
    profiles?: {
        name: string;
        phone?: string;
    };
};

export const mailDeliveryService = {
    /**
     * 입주사: 우편물 전달 요청 생성
     */
    async createRequest(request: Omit<MailDeliveryRequest, 'id' | 'status' | 'created_at' | 'updated_at'>) {
        const { data, error } = await supabase
            .from('mail_delivery_requests')
            .insert([request])
            .select()
            .single();
        if (error) throw error;
        return data as MailDeliveryRequest;
    },

    /**
     * 관리자: 지점의 모든 전달 요청 조회
     */
    async getRequestsByCompany(companyId: string) {
        const { data, error } = await supabase
            .from('mail_delivery_requests')
            .select('*, profiles(name, phone)')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as MailDeliveryRequest[];
    },

    /**
     * 입주사: 본인의 과거 신청 내역 조회 (주소 불러오기용)
     */
    async getMyRequests(profileId: string) {
        const { data, error } = await supabase
            .from('mail_delivery_requests')
            .select('*')
            .eq('profile_id', profileId)
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data as MailDeliveryRequest[];
    },

    /**
     * 관리자: 요청 상태 업데이트 (접수완료/발송완료)
     */
    async updateRequestStatus(id: string, status: MailDeliveryRequest['status']) {
        const { data, error } = await supabase
            .from('mail_delivery_requests')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();
        if (error) throw error;
        return data as MailDeliveryRequest;
    },

    /**
     * 관리자: 지점별 배송 안내 가이드 조회
     */
    async getDeliveryGuidelines(companyId: string) {
        const { data, error } = await supabase
            .from('companies')
            .select('delivery_guidelines')
            .eq('id', companyId)
            .single();
        if (error) throw error;
        return data.delivery_guidelines as string;
    },

    /**
     * 관리자: 지점별 배송 안내 가이드 업데이트
     */
    async updateDeliveryGuidelines(companyId: string, guidelines: string) {
        const { error } = await supabase
            .from('companies')
            .update({ delivery_guidelines: guidelines })
            .eq('id', companyId);
        if (error) throw error;
    }
};
