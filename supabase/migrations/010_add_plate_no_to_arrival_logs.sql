-- =============================================
-- 버스 도착 기록에 차량번호 추가
-- =============================================

-- 1. bus_arrival_logs에 plate_no 컬럼 추가
ALTER TABLE public.bus_arrival_logs
ADD COLUMN IF NOT EXISTS plate_no TEXT;

-- 인덱스 추가 (차량번호로 조회 시 성능 향상)
CREATE INDEX IF NOT EXISTS idx_bus_arrival_logs_plate_no
ON public.bus_arrival_logs(plate_no)
WHERE plate_no IS NOT NULL;

COMMENT ON COLUMN public.bus_arrival_logs.plate_no IS '도착한 버스의 차량번호';

-- 2. pending_arrivals에 plate_no 컬럼 추가
ALTER TABLE public.pending_arrivals
ADD COLUMN IF NOT EXISTS plate_no TEXT;

COMMENT ON COLUMN public.pending_arrivals.plate_no IS '곧 도착할 버스의 차량번호';
