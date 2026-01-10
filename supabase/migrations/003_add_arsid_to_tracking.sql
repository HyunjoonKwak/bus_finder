-- =============================================
-- bus_tracking_targets에 arsId 컬럼 추가
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- arsId 컬럼 추가 (정류소 고유번호 - 서울시/경기도 API 조회에 필요)
ALTER TABLE public.bus_tracking_targets
ADD COLUMN IF NOT EXISTS ars_id text;

-- 인덱스 추가 (선택적)
CREATE INDEX IF NOT EXISTS idx_bus_tracking_targets_ars_id
ON public.bus_tracking_targets(ars_id)
WHERE ars_id IS NOT NULL;
