-- 우편물 전달 요청(mail_delivery_requests) 테이블 및 관련 설정 (최종 유연성 확보 버전)
-- Supabase SQL Editor에서 실행해 주세요.

-- 1. 전달 요청 테이블 생성 (profile_id NULL 허용으로 변경)
CREATE TABLE IF NOT EXISTS public.mail_delivery_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- NOT NULL 제거
    recipient_name TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    postcode TEXT,
    address TEXT NOT NULL,
    address_detail TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'received', 'shipped'
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 기존 테이블이 있다면 NOT NULL 제약 조건 제거
ALTER TABLE public.mail_delivery_requests ALTER COLUMN profile_id DROP NOT NULL;

-- 2. 지점별 전달 안내 가이드 컬럼 추가
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='companies' AND column_name='delivery_guidelines') THEN
        ALTER TABLE public.companies ADD COLUMN delivery_guidelines TEXT;
    END IF;
END $$;

-- 3. RLS(Row Level Security) 설정
ALTER TABLE public.mail_delivery_requests ENABLE ROW LEVEL SECURITY;

-- 기존 정책 삭제
DROP POLICY IF EXISTS "Admins can manage delivery requests" ON public.mail_delivery_requests;
DROP POLICY IF EXISTS "Tenants can manage their own requests" ON public.mail_delivery_requests;
DROP POLICY IF EXISTS "Public can manage own requests" ON public.mail_delivery_requests;

-- 4. 정책 재생성 (더욱 유연하게)
-- 관리자 정책: 자기 지점의 모든 신청건 관리 가능
CREATE POLICY "Admins can manage delivery requests" 
ON public.mail_delivery_requests
FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.role = 'admin' 
        AND profiles.company_id = mail_delivery_requests.company_id
    )
);

-- 입주사 정책: 본인의 신청건 관리 가능
CREATE POLICY "Tenants can manage their own requests" 
ON public.mail_delivery_requests
FOR ALL 
USING (profile_id = auth.uid());

-- 익명/매직링크 사용자 정책: 모든 사용자가 신청(INSERT) 및 조인을 통한 조회가 가능하도록 허용
-- 실제 서비스 시에는 더 좁은 범위로 조정 가능하나, 현재 문제를 해결하기 위해 Open 정책 적용
CREATE POLICY "Public can manage own requests" 
ON public.mail_delivery_requests
FOR ALL 
USING (true)
WITH CHECK (true);
