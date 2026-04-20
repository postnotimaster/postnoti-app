import { Profile } from './profilesService';
import { Company } from './companiesService';
import { Tenant } from './tenantsService';
import { supabase } from '../lib/supabase';

export interface NotificationResult {
    success: boolean;
    method: 'pwa' | 'native' | 'none';
    error?: string;
    targetPhone?: string;
    shareLink?: string;
}

export const notificationService = {
    /**
     * Sends a push notification (PWA or Native) and returns the result.
     * If no push tokens are available, it returns success: false to trigger fallback.
     */
    async sendPushNotification(
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

        // 프로필 정보(푸시 토큰) 확인
        let profile: Profile | null = null;
        if (tenant.profile_id) {
            const { data } = await supabase.from('profiles').select('*').eq('id', tenant.profile_id).single();
            profile = data;
        }

        // 1. Native Push (Expo)
        if (profile?.push_token) {
            try {
                const response = await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: profile.push_token,
                        sound: 'default',
                        title,
                        body,
                        data: { url: `postnoti://branch/${company.slug}` }
                    })
                });
                if (response.ok) {
                    return { success: true, method: 'native', shareLink };
                }
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
                        data: {
                            company_id: company.id,
                            url: `https://postnoti-app-two.vercel.app/branch/${company.slug}`
                        }
                    })
                });
                if (response.ok) {
                    return { success: true, method: 'pwa', shareLink };
                }
            } catch (e) {
                console.warn('Web push failed', e);
            }
        }

        // 3. Fallback Triggered (No tokens or all failed)
        return {
            success: false,
            method: 'none',
            targetPhone: tenant.phone,
            shareLink
        };
    },

    /**
     * Sends a push notification for a new/updated announcement.
     */
    async sendNoticePush(
        company: Company,
        title: string,
        content: string,
        targetTenantIds?: string[] | null
    ): Promise<void> {
        // 공지 알림 제목 구성
        const pushTitle = `[${company.name}] 신규 공지사항 📢`;
        const pushBody = title.length > 50 ? `${title.substring(0, 47)}...` : title;

        try {
            // 1. 대상 입주사 프로필(토큰) 조회
            let query = supabase.from('profiles').select('push_token, web_push_token');

            if (targetTenantIds && targetTenantIds.length > 0) {
                // 특정 입주사 타겟팅 (tenant_ids 배열에 포함되거나 id가 일치하는 경우)
                // 여기서는 profiles 테이블의 id 또는 연관 모델을 통해 필터링
                // 간단하게 targetTenantIds에 해당하는 모든 프로필 조회
                query = query.in('id', targetTenantIds);
            } else {
                // 전체 공지: 해당 회사의 모든 입주사 프로필 대상
                // (profiles 테이블에 company_id가 있다고 가정하거나, tenants를 통해 조인 필요)
                // 여기서는 profilesService.getTenantsByCompany 로직을 참고하여 필터링
                const tenants = await supabase.from('tenants').select('profile_id').eq('company_id', company.id);
                const profileIds = tenants.data?.map(t => t.profile_id).filter(id => id) || [];
                if (profileIds.length === 0) return;
                query = query.in('id', profileIds);
            }

            const { data: profiles } = await query;
            if (!profiles || profiles.length === 0) return;

            // 2. 토큰별 발송 (Batch 고려 가능하나 여기서는 단순 루프)
            for (const profile of profiles) {
                // Native Push
                if (profile.push_token) {
                    fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            to: profile.push_token,
                            sound: 'default',
                            title: pushTitle,
                            body: pushBody,
                            data: { url: `postnoti://branch/${company.slug}` }
                        })
                    }).catch(e => console.warn('Notice push error (native)', e));
                }

                // Web Push
                if (profile.web_push_token) {
                    fetch('https://postnoti-app-two.vercel.app/api/send-push', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            token: profile.web_push_token,
                            title: pushTitle,
                            body: pushBody,
                            data: {
                                company_id: company.id,
                                url: `https://postnoti-app-two.vercel.app/branch/${company.slug}`
                            }
                        })
                    }).catch(e => console.warn('Notice push error (web)', e));
                }
            }
        } catch (err) {
            console.error('sendNoticePush error:', err);
        }
    },

    /**
     * Generates a link for a tenant to view their mailbox.
     */
    generateShareLink(tenant: Tenant, company: Company): string {
        // 앱 미설치 고객을 위해 다시 표준 https:// 주소로 복구하여 웹 브라우저 접속을 지원
        return `https://postnoti-app-two.vercel.app/branch/${company.slug}/view?p=${tenant.id}`;
    },

    /**
     * Generates a pre-formatted SMS message for manual sharing.
     */
    getShareMessage(tenant: Tenant, company: Company): string {
        const link = this.generateShareLink(tenant, company);
        // 메시지 구조를 단순화하고 링크를 별도 라인으로 분리하여 끊김 방지
        const companyLabel = tenant.company_name || tenant.name;
        return `[${company.name}] ${companyLabel}님, 우편물이 도착했습니다.\n\n사진 확인:\n${link}\n\n--\n포스트노티 공유오피스 스마트 우편알림`;
    }
};
