-- ==========================================
-- 1. 우편물 통계 개선용 통계 집계 RPC (단일 조회)
-- get_mail_stats_by_company
-- ==========================================

CREATE OR REPLACE FUNCTION get_mail_stats_by_company(p_company_id UUID)   
RETURNS TABLE(
  tenant_id UUID,
  total BIGINT,
  read BIGINT,
  last_sent_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.tenant_id,
    COUNT(m.id) as total,
    COUNT(m.read_at) as read,
    MAX(m.created_at) as last_sent_at
  FROM mail_logs m
  WHERE m.company_id = p_company_id
  GROUP BY m.tenant_id;
END;
$$;


-- ==========================================
-- 2. 기존 입주사 데이터 상태값(status) 일괄 동기화 (Backfill)
-- ==========================================
UPDATE tenants
SET status = CASE WHEN is_active = true THEN '입주' ELSE '퇴거' END       
WHERE status IS NULL;


-- ==========================================
-- 3. 📢 공지사항(Announcements) 테이블 생성
-- ==========================================

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    priority INTEGER DEFAULT 0, -- 0: 일반, 1: 중요(상단 고정 등)
    target_tenant_ids UUID[] DEFAULT NULL, -- NULL이면 전체 공지, 배열이면 특정 입주사 타겟팅
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 설정
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Reading Policy (Simple for now, can be restricted further)
CREATE POLICY "Users can view announcements of their company" ON announcements
    FOR SELECT
    USING (true);

-- Management Policy (For Admins)
CREATE POLICY "Admins can manage announcements" ON announcements
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_announcements_updated_at ON announcements;
CREATE TRIGGER update_announcements_updated_at
    BEFORE UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ==========================================
-- 4. 🔒 보안 강화형 조회 함수 (RPC)
-- 입주자 앱에서 RLS를 우회하여 특정 정보를 조회할 때 사용 (SECURITY DEFINER)
-- ==========================================

-- 4-1. ID 기반 입주사 조회 (매직링크용)
CREATE OR REPLACE FUNCTION get_tenant_by_id_secure(p_tenant_id UUID)
RETURNS SETOF tenants
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM tenants WHERE id = p_tenant_id;
END;
$$;

-- 4-2. 이름/전화번호 기반 입주사 조회 (인증용)
CREATE OR REPLACE FUNCTION find_tenant_by_name_and_phone_secure(p_company_id UUID, p_name TEXT, p_phone_suffix TEXT)
RETURNS SETOF tenants
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT * FROM tenants 
  WHERE company_id = p_company_id 
    AND name = p_name 
    AND phone LIKE '%' || p_phone_suffix;
END;
$$;
