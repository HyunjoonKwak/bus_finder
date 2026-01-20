-- =============================================
-- 페어 정류장 테이블 (정류장간 비교 분석용)
-- =============================================

-- 1. station_pairs 테이블 생성
CREATE TABLE IF NOT EXISTS public.station_pairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bus_id TEXT NOT NULL,
  bus_no TEXT NOT NULL,

  -- 정류장 A (출발)
  station_a_id TEXT NOT NULL,
  station_a_name TEXT NOT NULL,
  station_a_ars_id TEXT,

  -- 정류장 B (도착)
  station_b_id TEXT NOT NULL,
  station_b_name TEXT NOT NULL,
  station_b_ars_id TEXT,

  -- 메타데이터
  name TEXT,  -- 사용자 지정 이름 (예: "출근길", "퇴근길")
  created_at TIMESTAMPTZ DEFAULT now(),

  -- 같은 사용자가 같은 버스의 같은 정류장 조합은 중복 불가
  CONSTRAINT unique_user_bus_stations UNIQUE (user_id, bus_id, station_a_id, station_b_id)
);

-- 2. 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_station_pairs_user_id
ON public.station_pairs(user_id);

CREATE INDEX IF NOT EXISTS idx_station_pairs_bus_id
ON public.station_pairs(bus_id);

-- 3. RLS 정책 설정
ALTER TABLE public.station_pairs ENABLE ROW LEVEL SECURITY;

-- 자신의 페어만 조회 가능
CREATE POLICY "Users can view own station pairs"
ON public.station_pairs FOR SELECT
USING (auth.uid() = user_id);

-- 자신의 페어만 생성 가능
CREATE POLICY "Users can create own station pairs"
ON public.station_pairs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 자신의 페어만 수정 가능
CREATE POLICY "Users can update own station pairs"
ON public.station_pairs FOR UPDATE
USING (auth.uid() = user_id);

-- 자신의 페어만 삭제 가능
CREATE POLICY "Users can delete own station pairs"
ON public.station_pairs FOR DELETE
USING (auth.uid() = user_id);

-- 4. 코멘트 추가
COMMENT ON TABLE public.station_pairs IS '정류장간 비교 분석을 위한 페어 정류장 설정';
COMMENT ON COLUMN public.station_pairs.station_a_id IS '출발 정류장 ID';
COMMENT ON COLUMN public.station_pairs.station_b_id IS '도착 정류장 ID';
COMMENT ON COLUMN public.station_pairs.name IS '사용자 지정 이름 (예: 출근길)';
