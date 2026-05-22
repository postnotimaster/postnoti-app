-- 아이폰 홈 화면 추가(PWA) 등에서 파라미터가 유실되어 관리자 로그인 화면이 뜰 경우,
-- 입주자가 자신의 전화번호만으로 소속 지점을 찾아 로그인할 수 있게 해주는 전역 검색 함수입니다.

CREATE OR REPLACE FUNCTION global_find_tenant_by_phone_secure(p_phone TEXT)
RETURNS TABLE (
    tenant_id UUID,
    tenant_name TEXT,
    company_id UUID,
    company_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    clean_target_phone TEXT;
BEGIN
    clean_target_phone := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
    
    RETURN QUERY
    SELECT t.id, t.name, c.id, c.name
    FROM tenants t
    JOIN companies c ON t.company_id = c.id
    WHERE REGEXP_REPLACE(t.phone, '[^0-9]', '', 'g') LIKE '%' || (
          CASE 
              WHEN length(clean_target_phone) >= 8 THEN right(clean_target_phone, 8)
              ELSE clean_target_phone
          END
      );
END;
$$;
