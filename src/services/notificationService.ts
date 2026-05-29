import { Alert } from 'react-native';
import { Profile } from './profilesService';
import { Company } from './companiesService';
import { Tenant } from './tenantsService';
import { supabase } from '../lib/supabase';

export interface NotificationResult {
    success: boolean;
    method: 'pwa' | 'native' | 'both' | 'none';
    error?: string;
    targetPhone?: string;
    shareLink?: string;
}

export const notificationService = {
    /**
     * 범용 푸시 알림 전송 (여러 사용자 대상)
     */
    async sendPushNotification(
        profileIds: string[],
        title: string,
        body: string,
        data: any = {}
    ): Promise<void> {
        if (!profileIds || profileIds.length === 0) return;

        try {
            const { data: profiles } = await supabase
                .from('profiles')
                .select('id, push_token, web_push_token')
                .in('id', profileIds);

            if (!profiles || profiles.length === 0) {
                return;
            }

            // 1. 모든 유효한 토큰 수집 및 중복 제거
            const uniqueExpoTokens = new Set<string>();
            const uniqueWebTokens = new Set<string>();
            
            // 한 사용자가 네이티브 토큰을 가지고 있다면 웹 토큰은 제외하기 위해 추적
            const profilesWithNative = new Set<string>();

            profiles.forEach(p => {
                if (p.push_token) {
                    uniqueExpoTokens.add(p.push_token);
                    profilesWithNative.add(p.id);
                }
            });

            profiles.forEach(p => {
                // 네이티브 토큰이 없는 프로필이거나, 네이티브 토큰 전송 목록에 없는 웹 토큰만 추가
                if (p.web_push_token && !profilesWithNative.has(p.id)) {
                    uniqueWebTokens.add(p.web_push_token);
                }
            });

            // 2. 네이티브 푸시 발송 (중복 없는 토큰 리스트 대상)
            for (const token of uniqueExpoTokens) {
                try {
                    await fetch('https://postnoti-app-two.vercel.app/api/send-expo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: token,
                            sound: 'default',
                            title,
                            body,
                            priority: 'high',
                            data: { ...data, url: `postnoti://view` }
                        })
                    });
                } catch (e) {
                    console.warn('[NotificationService] Expo fetch error:', e);
                }
            }

            // 3. 웹 푸시 발송 (중복 없는 토큰 리스트 대상)
            for (const token of uniqueWebTokens) {
                try {
                    await fetch('https://postnoti-app-two.vercel.app/api/send-push', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            token,
                            title,
                            body,
                            data: { ...data, url: `https://postnoti-app-two.vercel.app/view` }
                        })
                    });
                } catch (e) {
                    // ignore web push errors
                }
            }
        } catch (err: any) {
            console.error('sendPushNotification error:', err);
        }
    },

    /**
     * 우편물 도착 알림 (기존 로직 유지)
     */
    async sendMailArrivalPush(
        tenant: Tenant,
        company: Company,
        sender: string,
        type: string,
        customMessage?: string
    ): Promise<NotificationResult> {
        const title = `[${company.name}] 우편물 도착 📮`;
        const companyLabel = tenant.company_name || tenant.name;
        const body = customMessage || `${companyLabel}님, ${sender ? `${sender}에서 보낸 ` : ''}${type} 우편물이 도착했습니다.`;
        const shareLink = this.generateShareLink(tenant, company);

        // [혁명적 개선] RPC를 사용하여 보안 벽(RLS)을 우회하고 실제 앱 설치 여부를 확인
        const { data: pushStatus, error: rpcError } = await supabase.rpc('check_tenant_push_status', {
            p_company_id: tenant.company_id,
            p_phone: tenant.phone
        });

        if (rpcError) {
            console.error('[NotificationService] Push status check failed:', rpcError);
        }

        const profile = (pushStatus && pushStatus.length > 0) ? pushStatus[0] : null;

        let success = false;
        let method: 'pwa' | 'native' | 'both' | 'none' = 'none';

        // 1. Native Push (Expo)
        if (profile?.push_token) {
            try {
                const response = await fetch('https://postnoti-app-two.vercel.app/api/send-expo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: profile.push_token,
                        sound: 'default',
                        title,
                        body,
                        data: { url: shareLink }
                    })
                });
                if (response.ok) { success = true; method = 'native'; }
            } catch (e) {
                console.warn('Expo push failed', e);
            }
        }

        // 2. Web Push (Firebase)
        if (profile?.web_push_token) {
            try {
                const response = await fetch('https://postnoti-app-two.vercel.app/api/send-push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: profile.web_push_token,
                        title,
                        body,
                        data: { company_id: company.id, url: shareLink }
                    })
                });
                if (response.ok) { 
                    success = true; 
                    method = method === 'native' ? 'both' : 'pwa'; 
                }
            } catch (e) {
                console.warn('Web push failed', e);
            }
        }

        if (success) return { success: true, method, shareLink };
        return { success: false, method: 'none', targetPhone: tenant.phone, shareLink };
    },

    /**
     * 공지사항 알림
     */
    async sendNoticePush(
        company: Company,
        title: string,
        content: string,
        targetTenantIds?: string[] | null
    ): Promise<void> {
        const pushTitle = `[${company.name}] 신규 공지사항 📢`;
        const pushBody = title.length > 50 ? `${title.substring(0, 47)}...` : title;

        try {
            let query = supabase.from('profiles').select('id, push_token, web_push_token');

            if (targetTenantIds && targetTenantIds.length > 0) {
                // [수정] targetTenantIds는 tenants 테이블의 ID이므로, profile_id를 먼저 조회해야 함
                const { data: tenants } = await supabase
                    .from('tenants')
                    .select('profile_id')
                    .in('id', targetTenantIds);

                const profileIds = tenants?.map(t => t.profile_id).filter(id => id) || [];
                if (profileIds.length === 0) {
                    console.log('[NotificationService] No linked profiles found for targeted tenants');
                    return;
                }
                query = query.in('id', profileIds);
            } else {
                const { data: tenants } = await supabase.from('tenants').select('profile_id').eq('company_id', company.id);
                const profileIds = tenants?.map(t => t.profile_id).filter(id => id) || [];
                if (profileIds.length === 0) return;
                query = query.in('id', profileIds);
            }

            const { data: profiles } = await query;
            if (!profiles || profiles.length === 0) return;

            const ids = profiles.map(p => p.id);
            await this.sendPushNotification(ids, pushTitle, pushBody, { type: 'notice' });
        } catch (err) {
            console.error('sendNoticePush error:', err);
        }
    },

    /**
     * 우편물 전달 상태 변경 알림
     */
    async sendDeliveryStatusPush(
        profileId: string,
        companyName: string,
        newStatus: string
    ): Promise<void> {
        const title = `[${companyName}] 우편물 전달 소식 🚚`;
        const statusLabels: Record<string, string> = {
            'received': '접수 완료 (입금 대기)',
            'paid': '입금 확인 (발송 준비 중)',
            'shipped': '발송 완료'
        };
        const statusText = statusLabels[newStatus] || newStatus;
        const body = `신청하신 우편물 전달 요청 상태가 [${statusText}] 단계로 변경되었습니다.`;

        await this.sendPushNotification([profileId], title, body, { type: 'mail_delivery' });
    },

    /**
     * [절대 수정 금지] 입주사 전용 우편함 다이렉트 링크 생성 로직
     * - p(입주사ID)가 m(지점ID)보다 반드시 앞에 와야 함 (문자 앱 주소 절단 방지용)
     * - 이 순서를 바꾸면 안드로이드/iOS 특정 기종에서 로그인 없이 바로 열기 기능이 깨짐
     */
    generateShareLink(tenant: any, company: any): string {
        const tenantId = tenant?.id || tenant?.tenant_id || tenant?.profile_id || tenant?.uid;
        if (!tenantId) return `https://postnoti-app-two.vercel.app/?m=${company?.id}`;

        return `https://postnoti-app-two.vercel.app/?p=${tenantId}`;
    },

    getShareMessage(tenant: any, company: any): string {
        const link = this.generateShareLink(tenant, company).replace('https://', ''); // 문자 길이 압축
        return `[포스트노티]우편도착\n확인:${link}`;
    }
};
