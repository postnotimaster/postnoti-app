-- 전화번호만으로 입주자를 안전하게 조회하는 보안 우회(SECURITY DEFINER) 함수
-- 관리자가 등록한 입주자 명단(tenants)에서 뒷자리 8자리가 일치하는 대상을 찾습니다.

CREATE OR REPLACE FUNCTION find_tenant_by_phone_secure(p_company_id UUID, p_phone TEXT)
RETURNS SETOF tenants
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    clean_target_phone TEXT;
BEGIN
    -- 입력된 번호에서 숫자만 추출
    clean_target_phone := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
    
    RETURN QUERY
    SELECT *
    FROM tenants
    WHERE company_id = p_company_id
      AND REGEXP_REPLACE(phone, '[^0-9]', '', 'g') LIKE '%' || (
          CASE 
              -- 최소 뒤 8자리(또는 전체)가 일치하는지 확인하여 유연성과 정확도 동시 확보
              WHEN length(clean_target_phone) >= 8 THEN right(clean_target_phone, 8)
              ELSE clean_target_phone
          END
      );
END;
$$;
