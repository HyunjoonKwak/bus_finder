-- =============================================
-- 스케줄러 분산 락 (여러 프로세스 중복 실행 방지)
-- =============================================

-- scheduler_settings에 락 관련 컬럼 추가
ALTER TABLE public.scheduler_settings
ADD COLUMN IF NOT EXISTS lock_holder_id TEXT,
ADD COLUMN IF NOT EXISTS lock_acquired_at TIMESTAMPTZ;

-- 락 자동 해제용 인덱스 (60초 이상 지난 락)
CREATE INDEX IF NOT EXISTS idx_scheduler_settings_lock_expired
ON public.scheduler_settings(lock_acquired_at)
WHERE lock_holder_id IS NOT NULL;

COMMENT ON COLUMN public.scheduler_settings.lock_holder_id IS '락을 보유한 프로세스 ID';
COMMENT ON COLUMN public.scheduler_settings.lock_acquired_at IS '락 획득 시간 (heartbeat 갱신)';
