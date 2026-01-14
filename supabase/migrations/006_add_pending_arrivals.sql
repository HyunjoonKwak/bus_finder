-- =============================================
-- pending_arrivals 테이블 및 관련 컬럼 추가
-- 버스 도착 감지를 위한 임시 상태 저장 테이블
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. bus_tracking_targets에 next_check_at 컬럼 추가
ALTER TABLE public.bus_tracking_targets
ADD COLUMN IF NOT EXISTS next_check_at timestamptz DEFAULT now();

-- 인덱스 추가 (Cron에서 다음 체크 시간 조회용)
CREATE INDEX IF NOT EXISTS idx_bus_tracking_targets_next_check
ON public.bus_tracking_targets(next_check_at)
WHERE is_active = true;

-- 2. pending_arrivals 테이블 생성
-- 곧 도착 상태(3분 이내)를 추적하여 도착 판정에 사용
CREATE TABLE IF NOT EXISTS public.pending_arrivals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bus_id text NOT NULL,
  bus_no text NOT NULL,
  station_id text NOT NULL,
  station_name text NOT NULL,
  ars_id text,
  arrival_sec integer NOT NULL, -- 마지막으로 확인된 도착 예정 시간(초)
  updated_at timestamptz DEFAULT now(),

  -- 복합 유니크 키 (user_id + bus_id + station_id 조합당 하나의 pending만)
  UNIQUE(user_id, bus_id, station_id)
);

-- RLS 활성화
ALTER TABLE public.pending_arrivals ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 본인 데이터만 접근 가능
CREATE POLICY "Users can view own pending arrivals"
  ON public.pending_arrivals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pending arrivals"
  ON public.pending_arrivals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pending arrivals"
  ON public.pending_arrivals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pending arrivals"
  ON public.pending_arrivals FOR DELETE
  USING (auth.uid() = user_id);

-- Service Role을 위한 정책 (Cron에서 사용)
-- Service Role은 RLS를 우회하므로 별도 정책 불필요

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_pending_arrivals_lookup
ON public.pending_arrivals(user_id, bus_id, station_id);

CREATE INDEX IF NOT EXISTS idx_pending_arrivals_updated
ON public.pending_arrivals(updated_at);

-- 3. notification_settings에 막차 알림 관련 컬럼 추가 (이미 있을 수 있음)
-- last_bus_time: 막차 시간 저장 (HH:MM 형식)
ALTER TABLE public.notification_settings
ADD COLUMN IF NOT EXISTS last_bus_time text;

-- last_notified_at: 마지막 알림 발송 시간 (중복 방지)
ALTER TABLE public.notification_settings
ADD COLUMN IF NOT EXISTS last_notified_at timestamptz;

COMMENT ON TABLE public.pending_arrivals IS '버스 도착 감지를 위한 임시 상태 테이블. 3분 이내 도착 예정 상태를 추적하여 도착 판정에 사용';
COMMENT ON COLUMN public.pending_arrivals.arrival_sec IS '마지막으로 확인된 도착 예정 시간(초). 상태 변화 감지에 사용';
