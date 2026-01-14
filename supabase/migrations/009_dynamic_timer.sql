-- 동적 타이머 시스템 지원: API 호출 카운터 및 제약 조건

-- API 호출 카운터 테이블
CREATE TABLE IF NOT EXISTS public.api_call_counter (
  call_date DATE PRIMARY KEY,
  call_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.api_call_counter IS 'API 일일 호출량 추적';
COMMENT ON COLUMN public.api_call_counter.call_date IS '호출 날짜';
COMMENT ON COLUMN public.api_call_counter.call_count IS '해당 날짜의 총 API 호출 횟수';

-- API 호출 카운트 증가 함수
CREATE OR REPLACE FUNCTION public.increment_api_call_count()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  new_count INTEGER;
BEGIN
  INSERT INTO public.api_call_counter (call_date, call_count, updated_at)
  VALUES (today, 1, NOW())
  ON CONFLICT (call_date)
  DO UPDATE SET
    call_count = api_call_counter.call_count + 1,
    updated_at = NOW()
  RETURNING call_count INTO new_count;

  RETURN new_count;
END;
$$;

-- 오늘의 API 호출 횟수 조회 함수
CREATE OR REPLACE FUNCTION public.get_today_api_calls()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  today DATE := CURRENT_DATE;
  count INTEGER;
BEGIN
  SELECT call_count INTO count
  FROM public.api_call_counter
  WHERE call_date = today;

  RETURN COALESCE(count, 0);
END;
$$;

-- 추적 대상 제한 체크 함수 (정류소 10개, 버스 20개)
CREATE OR REPLACE FUNCTION public.check_tracking_limits(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  station_count INTEGER;
  bus_count INTEGER;
  max_stations INTEGER := 10;
  max_buses INTEGER := 20;
BEGIN
  -- 활성화된 고유 정류소 수
  SELECT COUNT(DISTINCT station_id) INTO station_count
  FROM public.bus_tracking_targets
  WHERE user_id = p_user_id AND is_active = true;

  -- 활성화된 총 추적 대상 수
  SELECT COUNT(*) INTO bus_count
  FROM public.bus_tracking_targets
  WHERE user_id = p_user_id AND is_active = true;

  RETURN json_build_object(
    'stations', json_build_object(
      'current', station_count,
      'max', max_stations,
      'available', max_stations - station_count,
      'exceeded', station_count >= max_stations
    ),
    'buses', json_build_object(
      'current', bus_count,
      'max', max_buses,
      'available', max_buses - bus_count,
      'exceeded', bus_count >= max_buses
    )
  );
END;
$$;

-- 추적 대상 추가 전 제한 체크 트리거 함수
CREATE OR REPLACE FUNCTION public.enforce_tracking_limits()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  station_count INTEGER;
  bus_count INTEGER;
  max_stations INTEGER := 10;
  max_buses INTEGER := 20;
BEGIN
  -- 비활성화하는 경우는 항상 허용
  IF NEW.is_active = false THEN
    RETURN NEW;
  END IF;

  -- 기존 레코드를 활성화하는 경우 (UPDATE)
  IF TG_OP = 'UPDATE' AND OLD.is_active = true THEN
    RETURN NEW;
  END IF;

  -- 활성화된 고유 정류소 수
  SELECT COUNT(DISTINCT station_id) INTO station_count
  FROM public.bus_tracking_targets
  WHERE user_id = NEW.user_id AND is_active = true;

  -- 새 정류소인지 확인
  IF NOT EXISTS (
    SELECT 1 FROM public.bus_tracking_targets
    WHERE user_id = NEW.user_id
      AND station_id = NEW.station_id
      AND is_active = true
  ) THEN
    -- 새 정류소 추가 시 제한 체크
    IF station_count >= max_stations THEN
      RAISE EXCEPTION 'Maximum number of stations (%) reached', max_stations;
    END IF;
  END IF;

  -- 활성화된 총 추적 대상 수
  SELECT COUNT(*) INTO bus_count
  FROM public.bus_tracking_targets
  WHERE user_id = NEW.user_id AND is_active = true;

  IF bus_count >= max_buses THEN
    RAISE EXCEPTION 'Maximum number of tracking targets (%) reached', max_buses;
  END IF;

  RETURN NEW;
END;
$$;

-- 트리거 생성 (이미 존재하면 삭제 후 재생성)
DROP TRIGGER IF EXISTS enforce_tracking_limits_trigger ON public.bus_tracking_targets;
CREATE TRIGGER enforce_tracking_limits_trigger
  BEFORE INSERT OR UPDATE ON public.bus_tracking_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_tracking_limits();

-- 오래된 API 카운터 정리 함수 (30일 이상 된 데이터 삭제)
CREATE OR REPLACE FUNCTION public.cleanup_old_api_counters()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.api_call_counter
  WHERE call_date < CURRENT_DATE - INTERVAL '30 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- RLS 정책 (api_call_counter는 서비스 역할만 접근)
ALTER TABLE public.api_call_counter ENABLE ROW LEVEL SECURITY;

-- 서비스 역할 정책
CREATE POLICY "Service role can manage api_call_counter"
  ON public.api_call_counter
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
