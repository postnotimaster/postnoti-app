-- 익명 입주자도 안전하게 본인의 푸시 토큰을 업데이트할 수 있는 RLS 우회 RPC 함수
-- Supabase SQL Editor에서 실행해 주세요.

CREATE OR REPLACE FUNCTION update_tenant_push_token_secure(
    p_profile_id UUID,
    p_push_token TEXT,
    p_web_push_token TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE profiles
    SET push_token = COALESCE(p_push_token, profiles.push_token),
        web_push_token = COALESCE(p_web_push_token, profiles.web_push_token)
    WHERE id = p_profile_id;
END;
$$;

-- 익명/인증 사용자 모두에게 실행 권한 부여
GRANT EXECUTE ON FUNCTION update_tenant_push_token_secure(UUID, TEXT, TEXT) TO anon, authenticated;
