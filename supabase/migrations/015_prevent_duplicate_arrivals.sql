-- 015_prevent_duplicate_arrivals.sql
-- 동일 버스(plate_no)의 동일 정류장 도착 중복 방지

-- IMMUTABLE을 위해 timestamp (without time zone)로 캐스팅 필요
-- arrival_time::timestamp으로 캐스팅하여 IMMUTABLE 표현식 생성

-- plate_no가 있는 경우: 10분 구간 내 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_arrival_unique_per_trip
ON public.bus_arrival_logs (
  user_id,
  bus_id,
  station_id,
  plate_no,
  floor(extract(epoch from arrival_time::timestamp) / 600)
)
WHERE plate_no IS NOT NULL;

-- plate_no가 없는 경우: 30분 구간 내 중복 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_arrival_unique_no_plate
ON public.bus_arrival_logs (
  user_id,
  bus_id,
  station_id,
  floor(extract(epoch from arrival_time::timestamp) / 1800)
)
WHERE plate_no IS NULL;
