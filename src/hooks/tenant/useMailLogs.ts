import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { mailService } from '../../services/mailService';
import { MailLog } from '../../components/tenant/MailItem';

interface UseMailLogsProps {
    myProfileId?: string;
    myTenantId?: string;
    soundEnabled: boolean;
    playSound: () => void;
    showToast: (params: { message: string; type: 'success' | 'error' | 'info' }) => void;
}

export const useMailLogs = ({
    myProfileId,
    myTenantId,
    soundEnabled,
    playSound,
    showToast
}: UseMailLogsProps) => {
    const [mails, setMails] = useState<MailLog[]>([]);
    const [loading, setLoading] = useState(false);

    // 우편물 로드
    const loadMails = async (pId?: string, tId?: string) => {
        const targetPId = pId || myProfileId;
        const targetTId = tId || myTenantId;

        if (!targetPId && !targetTId) return;

        setLoading(true);
        try {
            let data: MailLog[] = [];
            if (targetTId) {
                data = await mailService.getMailsByTenant(targetTId);
            } else if (targetPId) {
                data = await mailService.getMailsByProfile(targetPId);
            }
            setMails(data || []);
        } catch (err) {
            console.error('Load Mails Error:', err);
        } finally {
            setLoading(false);
        }
    };

    // 실시간 구독
    useEffect(() => {
        if (!myProfileId && !myTenantId) return;

        const targetId = myTenantId || myProfileId;
        const filterColumn = myTenantId ? 'tenant_id' : 'profile_id';

        const channel = supabase
            .channel(`public:mail_logs:${targetId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'mail_logs',
                    filter: `${filterColumn}=eq.${targetId}`,
                },
                (payload) => {
                    if (soundEnabled) playSound();
                    setMails(prev => [payload.new as MailLog, ...prev]);
                    showToast({ message: '📬 방금 새로운 우편물이 도착했습니다!', type: 'success' });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [myProfileId, myTenantId, soundEnabled]);

    // 초기 로드
    useEffect(() => {
        if (myProfileId || myTenantId) {
            loadMails();
        }
    }, [myProfileId, myTenantId]);

    // 안읽은 개수 연산
    const unreadCount = useMemo(() => mails.filter(m => !m.read_at).length, [mails]);

    // 날짜별 그룹화 (성능 최적화 적용)
    const getGroupedMails = (filter: 'all' | 'unread') => {
        const filtered = mails.filter(mail => {
            if (filter === 'unread') return !mail.read_at;
            return true;
        });

        const groups: { [key: string]: MailLog[] } = {};
        filtered.forEach(mail => {
            if (!mail.created_at) return;
            const d = new Date(mail.created_at);
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const date = d.getDate();
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const day = dayNames[d.getDay()];

            const dateStr = `${year}년 ${month}월 ${date}일 (${day})`;

            // 오늘/어제 처리
            const now = new Date();
            const todayStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 (${dayNames[now.getDay()]})`;
            const yest = new Date(Date.now() - 86400000);
            const yestStr = `${yest.getFullYear()}년 ${yest.getMonth() + 1}월 ${yest.getDate()}일 (${dayNames[yest.getDay()]})`;

            let displayTitle = dateStr;
            if (dateStr === todayStr) displayTitle = `오늘 (${dateStr})`;
            else if (dateStr === yestStr) displayTitle = `어제 (${dateStr})`;

            if (!groups[displayTitle]) groups[displayTitle] = [];
            groups[displayTitle].push(mail);
        });

        return Object.keys(groups).map(title => ({
            title,
            data: groups[title]
        }));
    };

    return {
        mails,
        setMails,
        loading,
        unreadCount,
        loadMails,
        getGroupedMails
    };
};
