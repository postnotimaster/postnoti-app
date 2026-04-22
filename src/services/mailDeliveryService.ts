import { Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { notificationService } from './notificationService';

export type MailDeliveryStatus = 'pending' | 'received' | 'paid' | 'shipped';

export interface MailDeliveryRequest {
    id: string;
    company_id: string;
    profile_id: string;
    tenant_id?: string;
    recipient_name: string;
    recipient_phone: string;
    postcode: string;
    address: string;
    address_detail?: string;
    status: MailDeliveryStatus;
    created_at: string;
    updated_at: string;
    profiles?: {
        name: string;
    };
}

export const mailDeliveryService = {
    // 1. 전달 요청 생성 (입주사)
    async createRequest(data: Partial<MailDeliveryRequest>): Promise<MailDeliveryRequest> {
        const { data: request, error } = await supabase
            .from('mail_delivery_requests')
            .insert([
                {
                    ...data,
                    status: 'pending'
                }
            ])
            .select()
            .single();

        if (error) {
            if (error.code === '42P01') throw new Error('DB 설정이 완료되지 않았습니다. 관리자에게 문의해 주세요. (Table missing)');
            throw error;
        }

        // --- 관리자 알림 발송 ---
        try {
            // [지점 개념 제거] 지점 구분 없이 모든 관리자에게 알림 발송
            const { data: admins } = await supabase
                .from('profiles')
                .select('id, push_token, web_push_token')
                .eq('role', 'admin');

            if (admins && admins.length > 0) {
                const adminIdsWithTokens = admins
                    .filter(a => a.push_token || a.web_push_token)
                    .map(a => a.id);

                if (adminIdsWithTokens.length > 0) {
                    await notificationService.sendPushNotification(
                        adminIdsWithTokens,
                        '새로운 우편물 전달 신청',
                        `${data.recipient_name}님의 우편물 전달 신청이 접수되었습니다.`,
                        { type: 'mail_delivery', id: (request as any).id }
                    );
                }
            }
        } catch (pushError) {
            console.warn('Failed to send push notification to admins:', pushError);
        }

        return request;
    },

    // 2. 나의 요청 내역 조회 (입주사)
    async getMyRequests(userId: string): Promise<MailDeliveryRequest[]> {
        const { data, error } = await supabase
            .from('mail_delivery_requests')
            .select('*')
            .or(`profile_id.eq.${userId},tenant_id.eq.${userId}`)
            .order('created_at', { ascending: false });

        if (error) {
            if (error.code === '42P01') return [];
            throw error;
        }
        return data || [];
    },

    // 3. 지점별 신청 내역 조회 (관리자)
    async getRequestsByCompany(companyId: string): Promise<MailDeliveryRequest[]> {
        const { data, error } = await supabase
            .from('mail_delivery_requests')
            .select('*, profiles(name)')
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    // 4. 요청 상태 변경 (관리자)
    async updateRequestStatus(requestId: string, status: MailDeliveryStatus): Promise<MailDeliveryRequest> {
        const { data: request, error } = await supabase
            .from('mail_delivery_requests')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', requestId)
            .select()
            .single();

        if (error) throw error;

        // --- 입주자 알림 발송 ---
        try {
            const statusLabels: Record<string, string> = {
                'received': '접수 완료 (입금 대기)',
                'paid': '입금 확인 (발송 준비 중)',
                'shipped': '발송 완료'
            };

            await notificationService.sendPushNotification(
                [request.profile_id],
                '우편물 전달 상태 변경',
                `신청하신 우편물 전달 상태가 [${statusLabels[status] || status}] 단계로 변경되었습니다.`,
                { type: 'mail_delivery', id: request.id }
            );
        } catch (pushError) {
            console.warn('Failed to send push notification to tenant:', pushError);
        }

        return request;
    },

    // 5. 지점별 전달 안내 가이드 조회
    async getDeliveryGuidelines(companyId: string): Promise<string> {
        const { data, error } = await supabase
            .from('companies')
            .select('delivery_guidelines')
            .eq('id', companyId)
            .single();

        if (error) return '';
        return data?.delivery_guidelines || '';
    },

    // 6. 안내 가이드 업데이트 (관리자)
    async updateDeliveryGuidelines(companyId: string, guidelines: string): Promise<void> {
        const { error } = await supabase
            .from('companies')
            .update({ delivery_guidelines: guidelines })
            .eq('id', companyId);

        if (error) throw error;
    }
};
