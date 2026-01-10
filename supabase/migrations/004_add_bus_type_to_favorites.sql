-- favorite_routes 테이블에 bus_type 컬럼 추가
ALTER TABLE public.favorite_routes
ADD COLUMN IF NOT EXISTS bus_type integer;

-- 설명: 버스 노선 타입 (서울: 1=지선, 3=마을, 4=광역, 5=공항, 6=간선 / 경기: 11=직행좌석, 13=일반 등)
