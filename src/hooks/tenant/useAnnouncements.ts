import { useState, useEffect } from 'react';
import { noticeService, Announcement } from '../../services/noticeService';

interface UseAnnouncementsProps {
    companyId: string;
    tenantId?: string;
}

export const useAnnouncements = ({ companyId, tenantId }: UseAnnouncementsProps) => {
    const [announcements, setAnnouncements] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(false);

    const loadAnnouncements = async () => {
        if (!companyId) {
            console.log('[useAnnouncements] Missing companyId');
            return;
        }
        setLoading(true);
        try {
            console.log(`[useAnnouncements] Loading for Company: ${companyId}, Tenant: ${tenantId}`);
            let data: Announcement[] = [];
            if (tenantId) {
                // 특정 입주자 타겟팅 포함 조회
                data = await noticeService.getAnnouncementsForTenant(companyId, tenantId);
            } else {
                // 전체 공지 조회
                data = await noticeService.getAnnouncements(companyId);
            }
            console.log(`[useAnnouncements] Loaded ${data?.length || 0} notices`);
            setAnnouncements(data || []);
        } catch (err) {
            console.error('Load Announcements Error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAnnouncements();
    }, [companyId, tenantId]);

    return {
        announcements,
        loading,
        refreshAnnouncements: loadAnnouncements
    };
};
