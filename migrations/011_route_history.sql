-- 길찾기 이력 테이블
-- Supabase Dashboard > SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS route_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_name TEXT NOT NULL,        -- 출발지 이름
  origin_address TEXT,              -- 출발지 주소
  origin_x TEXT NOT NULL,           -- 출발지 경도
  origin_y TEXT NOT NULL,           -- 출발지 위도
  dest_name TEXT NOT NULL,          -- 도착지 이름
  dest_address TEXT,                -- 도착지 주소
  dest_x TEXT NOT NULL,             -- 도착지 경도
  dest_y TEXT NOT NULL,             -- 도착지 위도
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_route_history_user_id ON route_history(user_id);
CREATE INDEX IF NOT EXISTS idx_route_history_created_at ON route_history(created_at DESC);

-- RLS 정책
ALTER TABLE route_history ENABLE ROW LEVEL SECURITY;

-- 사용자 본인 데이터만 조회/수정 가능
CREATE POLICY "Users can view own route history" ON route_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own route history" ON route_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own route history" ON route_history
  FOR DELETE USING (auth.uid() = user_id);

-- 최대 50개 제한 (오래된 항목 자동 삭제)
CREATE OR REPLACE FUNCTION cleanup_route_history()
RETURNS TRIGGER AS $$
BEGIN
  -- 50개 초과 시 가장 오래된 항목 삭제
  DELETE FROM route_history
  WHERE id IN (
    SELECT id FROM route_history
    WHERE user_id = NEW.user_id
    ORDER BY created_at DESC
    OFFSET 50
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거
DROP TRIGGER IF EXISTS limit_route_history ON route_history;
CREATE TRIGGER limit_route_history
  AFTER INSERT ON route_history
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_route_history();
