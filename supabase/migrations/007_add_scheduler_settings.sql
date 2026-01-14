-- 글로벌 스케줄러 설정 테이블 (서버 전체에서 하나만 사용)
CREATE TABLE IF NOT EXISTS public.scheduler_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  enabled boolean DEFAULT false,
  interval_minutes integer DEFAULT 5,
  last_started_at timestamptz,
  updated_at timestamptz DEFAULT now()
);

-- 기본 스케줄러 설정 삽입
INSERT INTO public.scheduler_settings (key, enabled, interval_minutes)
VALUES ('arrival_collector', false, 5)
ON CONFLICT (key) DO NOTHING;

-- RLS 비활성화 (글로벌 설정이므로 모든 인증된 사용자가 읽을 수 있어야 함)
-- 서비스 롤로만 업데이트하도록 함
ALTER TABLE public.scheduler_settings ENABLE ROW LEVEL SECURITY;

-- 모든 인증된 사용자가 읽기 가능
CREATE POLICY "Authenticated users can view scheduler settings"
  ON public.scheduler_settings FOR SELECT
  TO authenticated
  USING (true);

-- 서비스 롤만 업데이트 가능 (API route에서 service client 사용)
-- INSERT/UPDATE/DELETE는 service_role로만 가능
