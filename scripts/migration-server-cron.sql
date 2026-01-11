-- 서버 기반 백그라운드 수집을 위한 DB 마이그레이션
-- 실행: Supabase SQL Editor에서 실행

-- 1. bus_tracking_targets 테이블에 next_check_at 컬럼 추가
ALTER TABLE public.bus_tracking_targets
ADD COLUMN IF NOT EXISTS next_check_at TIMESTAMPTZ DEFAULT NOW();

-- 2. pending_arrivals 테이블 생성 (곧 도착 상태 추적용)
CREATE TABLE IF NOT EXISTS public.pending_arrivals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bus_id TEXT NOT NULL,
  bus_no TEXT NOT NULL,
  station_id TEXT NOT NULL,
  station_name TEXT NOT NULL,
  ars_id TEXT,
  arrival_sec INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, bus_id, station_id)
);

-- RLS 활성화
ALTER TABLE public.pending_arrivals ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 pending arrivals만 관리 가능
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pending_arrivals' AND policyname = 'Users can manage own pending arrivals'
  ) THEN
    CREATE POLICY "Users can manage own pending arrivals"
      ON public.pending_arrivals FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- 서버 Cron용 서비스 계정 정책 (service_role 키 사용 시)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'pending_arrivals' AND policyname = 'Service role can manage all pending arrivals'
  ) THEN
    CREATE POLICY "Service role can manage all pending arrivals"
      ON public.pending_arrivals FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- bus_tracking_targets에도 서비스 계정 정책 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bus_tracking_targets' AND policyname = 'Service role can manage all targets'
  ) THEN
    CREATE POLICY "Service role can manage all targets"
      ON public.bus_tracking_targets FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- bus_arrival_logs에도 서비스 계정 정책 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bus_arrival_logs' AND policyname = 'Service role can manage all logs'
  ) THEN
    CREATE POLICY "Service role can manage all logs"
      ON public.bus_arrival_logs FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_tracking_targets_next_check
  ON public.bus_tracking_targets(next_check_at)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_pending_arrivals_user
  ON public.pending_arrivals(user_id, bus_id, station_id);

-- 확인용 쿼리
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'bus_tracking_targets'
  AND column_name = 'next_check_at';
