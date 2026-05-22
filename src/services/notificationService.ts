import { Alert } from 'react-native';
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
     * ë²”ìš© ?¸ì‹œ ?Œë¦¼ ?„ì†¡ (?¬ëŸ¬ ?¬ìš©???€??
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

            // 1. ëª¨ë“  ? íš¨??? í° ?˜ì§‘ ë°?ì¤‘ë³µ ?œê±°
            const uniqueExpoTokens = new Set<string>();
            const uniqueWebTokens = new Set<string>();
            
            // ???¬ìš©?ê? ?¤ì´?°ë¸Œ ? í°??ê°€ì§€ê³??ˆë‹¤ë©???? í°?€ ?œì™¸?˜ê¸° ?„í•´ ì¶”ì 
            const profilesWithNative = new Set<string>();

            profiles.forEach(p => {
                if (p.push_token) {
                    uniqueExpoTokens.add(p.push_token);
                    profilesWithNative.add(p.id);
                }
            });

            profiles.forEach(p => {
                // ?¤ì´?°ë¸Œ ? í°???†ëŠ” ?„ë¡œ?„ì´ê±°ë‚˜, ?¤ì´?°ë¸Œ ? í° ?„ì†¡ ëª©ë¡???†ëŠ” ??? í°ë§?ì¶”ê?
                if (p.web_push_token && !profilesWithNative.has(p.id)) {
                    uniqueWebTokens.add(p.web_push_token);
                }
            });

            // 2. ?¤ì´?°ë¸Œ ?¸ì‹œ ë°œì†¡ (ì¤‘ë³µ ?†ëŠ” ? í° ë¦¬ìŠ¤???€??
            for (const token of uniqueExpoTokens) {
                try {
                    await fetch('https://postnoti-app.vercel.app/api/send-expo', {
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

            // 3. ???¸ì‹œ ë°œì†¡ (ì¤‘ë³µ ?†ëŠ” ? í° ë¦¬ìŠ¤???€??
            for (const token of uniqueWebTokens) {
                try {
                    await fetch('https://postnoti-app.vercel.app/api/send-push', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            token,
                            title,
                            body,
                            data: { ...data, url: `https://postnoti-app.vercel.app/view` }
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
     * ?°í¸ë¬??„ì°© ?Œë¦¼ (ê¸°ì¡´ ë¡œì§ ? ì?)
     */
    async sendMailArrivalPush(
        tenant: Tenant,
        company: Company,
        sender: string,
        type: string,
        customMessage?: string
    ): Promise<NotificationResult> {
        const title = `[${company.name}] ?°í¸ë¬??„ì°© ?“®`;
        const companyLabel = tenant.company_name || tenant.name;
        const body = customMessage || `${companyLabel}?? ${sender ? `${sender}?ì„œ ë³´ë‚¸ ` : ''}${type} ?°í¸ë¬¼ì´ ?„ì°©?ˆìŠµ?ˆë‹¤.`;
        const shareLink = this.generateShareLink(tenant, company);

        // [?ëª…??ê°œì„ ] RPCë¥??¬ìš©?˜ì—¬ ë³´ì•ˆ ë²?RLS)???°íšŒ?˜ê³  ?¤ì œ ???¤ì¹˜ ?¬ë?ë¥??•ì¸
        const { data: pushStatus, error: rpcError } = await supabase.rpc('check_tenant_push_status', {
            p_company_id: tenant.company_id,
            p_phone: tenant.phone
        });

        if (rpcError) {
            console.error('[NotificationService] Push status check failed:', rpcError);
        }

        const profile = (pushStatus && pushStatus.length > 0) ? pushStatus[0] : null;

        // 1. Native Push (Expo)
        if (profile?.push_token) {
            try {
                const response = await fetch('https://postnoti-app.vercel.app/api/send-expo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: profile.push_token,
                        sound: 'default',
                        title,
                        body,
                        data: { url: shareLink } // [?˜ì •] ê¸?ì£¼ì†Œë¡?ë³€ê²?
                    })
                });
                if (response.ok) return { success: true, method: 'native', shareLink };
            } catch (e) {
                console.warn('Expo push failed', e);
            }
        }

        // 2. Web Push (Firebase)
        if (profile?.web_push_token) {
            try {
                const response = await fetch('https://postnoti-app.vercel.app/api/send-push', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        token: profile.web_push_token,
                        title,
                        body,
                        data: { company_id: company.id, url: shareLink } // [?˜ì •] ê¸?ì£¼ì†Œë¡?ë³€ê²?
                    })
                });
                if (response.ok) return { success: true, method: 'pwa', shareLink };
            } catch (e) {
                console.warn('Web push failed', e);
            }
        }

        return { success: false, method: 'none', targetPhone: tenant.phone, shareLink };
    },

    /**
     * ê³µì??¬í•­ ?Œë¦¼
     */
    async sendNoticePush(
        company: Company,
        title: string,
        content: string,
        targetTenantIds?: string[] | null
    ): Promise<void> {
        const pushTitle = `[${company.name}] ? ê·œ ê³µì??¬í•­ ?“¢`;
        const pushBody = title.length > 50 ? `${title.substring(0, 47)}...` : title;

        try {
            let query = supabase.from('profiles').select('id, push_token, web_push_token');

            if (targetTenantIds && targetTenantIds.length > 0) {
                // [?˜ì •] targetTenantIds??tenants ?Œì´ë¸”ì˜ ID?´ë?ë¡? profile_idë¥?ë¨¼ì? ì¡°íšŒ?´ì•¼ ??
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
     * ?°í¸ë¬??„ë‹¬ ?íƒœ ë³€ê²??Œë¦¼
     */
    async sendDeliveryStatusPush(
        profileId: string,
        companyName: string,
        newStatus: string
    ): Promise<void> {
        const title = `[${companyName}] ?°í¸ë¬??„ë‹¬ ?Œì‹ ?šš`;
        const statusLabels: Record<string, string> = {
            'received': '?‘ìˆ˜ ?„ë£Œ (?…ê¸ˆ ?€ê¸?',
            'paid': '?…ê¸ˆ ?•ì¸ (ë°œì†¡ ì¤€ë¹?ì¤?',
            'shipped': 'ë°œì†¡ ?„ë£Œ'
        };
        const statusText = statusLabels[newStatus] || newStatus;
        const body = `? ì²­?˜ì‹  ?°í¸ë¬??„ë‹¬ ?”ì²­ ?íƒœê°€ [${statusText}] ?¨ê³„ë¡?ë³€ê²½ë˜?ˆìŠµ?ˆë‹¤.`;

        await this.sendPushNotification([profileId], title, body, { type: 'mail_delivery' });
    },

    /**
     * [?ˆë? ?˜ì • ê¸ˆì?] ?…ì£¼???„ìš© ?°í¸???¤ì´?‰íŠ¸ ë§í¬ ?ì„± ë¡œì§
     * - p(?…ì£¼?¬ID)ê°€ m(ì§€?ID)ë³´ë‹¤ ë°˜ë“œ???ì— ?€????(ë¬¸ì ??ì£¼ì†Œ ?ˆë‹¨ ë°©ì???
     * - ???œì„œë¥?ë°”ê¾¸ë©??ˆë“œë¡œì´??iOS ?¹ì • ê¸°ì¢…?ì„œ ë¡œê·¸???†ì´ ë°”ë¡œ ?´ê¸° ê¸°ëŠ¥??ê¹¨ì§
     */
    generateShareLink(tenant: any, company: any): string {
        const tenantId = tenant?.id || tenant?.tenant_id || tenant?.profile_id || tenant?.uid;
        if (!tenantId) return `https://postnoti-app.vercel.app/view?m=${company?.id}`;

        return `https://postnoti-app.vercel.app/view?p=${tenantId}&m=${company?.id}`;
    },

    getShareMessage(tenant: any, company: any): string {
        const link = this.generateShareLink(tenant, company);
        const companyLabel = tenant.company_name || tenant.name;
        // [ê¸´ê¸‰ ?˜ì •] ì£¼ì†Œë¥?ë§??ìœ¼ë¡?ë°°ì¹˜?˜ì—¬ ë¬¸ì ?±ì—?œì˜ ?ˆë‹¨??ë°©ì?
        return `[${company.name}] ?°í¸???•ì¸: ${link}\n\n(? ê·œ?Œë¦¼) ${companyLabel}???°í¸ë¬¼ì´ ?„ì°©?ˆìŠµ?ˆë‹¤.\n?¬ìŠ¤?¸ë…¸???¤ë§ˆ???°í¸?Œë¦¼`;
    }
};
