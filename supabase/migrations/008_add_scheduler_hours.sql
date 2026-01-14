-- 스케줄러 운영 시간 추가
ALTER TABLE public.scheduler_settings
ADD COLUMN IF NOT EXISTS start_hour integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS end_hour integer DEFAULT 24;

-- 기본값 업데이트 (05:00 ~ 24:00)
UPDATE public.scheduler_settings
SET start_hour = 5, end_hour = 24
WHERE key = 'arrival_collector' AND start_hour IS NULL;

COMMENT ON COLUMN public.scheduler_settings.start_hour IS '스케줄러 시작 시간 (0-23)';
COMMENT ON COLUMN public.scheduler_settings.end_hour IS '스케줄러 종료 시간 (1-24, 24는 자정)';
