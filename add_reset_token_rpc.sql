-- 입주사의 알림 토큰을 초기화하기 위한 보안 우회(Security Definer) 함수입니다.
-- Supabase SQL Editor에서 실행해 주세요.

CREATE OR REPLACE FUNCTION reset_push_token_secure(p_profile_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles 
  SET push_token = NULL, web_push_token = NULL
  WHERE id = p_profile_id;
END;
$$;
