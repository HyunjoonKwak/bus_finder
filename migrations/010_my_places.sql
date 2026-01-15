-- 내 장소 테이블 (최대 5개 제한)
-- Supabase Dashboard > SQL Editor에서 실행

CREATE TABLE IF NOT EXISTS my_places (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,           -- 사용자 지정 이름 (집, 회사 등)
  place_name TEXT NOT NULL,     -- 실제 장소명
  address TEXT,                 -- 주소
  x TEXT NOT NULL,              -- 경도
  y TEXT NOT NULL,              -- 위도
  icon TEXT DEFAULT 'pin',      -- 아이콘 타입 (home, office, pin)
  sort_order INTEGER DEFAULT 0, -- 정렬 순서
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_my_places_user_id ON my_places(user_id);

-- RLS 정책
ALTER TABLE my_places ENABLE ROW LEVEL SECURITY;

-- 사용자 본인 데이터만 조회/수정 가능
CREATE POLICY "Users can view own places" ON my_places
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own places" ON my_places
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own places" ON my_places
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own places" ON my_places
  FOR DELETE USING (auth.uid() = user_id);

-- 최대 5개 제한 함수
CREATE OR REPLACE FUNCTION check_my_places_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM my_places WHERE user_id = NEW.user_id) >= 5 THEN
    RAISE EXCEPTION 'Maximum 5 places allowed per user';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거
DROP TRIGGER IF EXISTS enforce_my_places_limit ON my_places;
CREATE TRIGGER enforce_my_places_limit
  BEFORE INSERT ON my_places
  FOR EACH ROW
  EXECUTE FUNCTION check_my_places_limit();
