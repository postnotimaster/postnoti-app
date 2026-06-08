-- 입주사 정보에 특이사항을 기록할 수 있는 'memo' 컬럼을 추가합니다.
-- Supabase SQL Editor에서 한 번만 실행해 주세요!

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS memo TEXT;

-- 데이터베이스 API 캐시 새로고침
NOTIFY pgrst, 'reload schema';
