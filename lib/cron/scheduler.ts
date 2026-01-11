import cron from 'node-cron';
import { collectArrivals } from './collect-arrivals';

let isRunning = false;
let isCollecting = false;

/**
 * node-cron 스케줄러 시작
 * 1분마다 실행되며, next_check_at 체크는 collectArrivals 내부에서 수행
 */
export function startCronScheduler() {
  if (isRunning) {
    console.log('[Cron] Scheduler already running');
    return;
  }
  isRunning = true;

  // 1분마다 실행 (* * * * *)
  cron.schedule('* * * * *', async () => {
    // 이전 수집이 진행 중이면 스킵 (중복 실행 방지)
    if (isCollecting) {
      console.log('[Cron] Previous collection still running, skipping...');
      return;
    }

    isCollecting = true;
    const startTime = Date.now();

    try {
      console.log('[Cron] Running collection check...');
      const result = await collectArrivals();

      const duration = Date.now() - startTime;
      console.log(
        `[Cron] Done in ${duration}ms: ${result.checked} checked, ${result.logged} logged`
      );

      if (result.errors.length > 0) {
        console.error('[Cron] Errors:', result.errors);
      }
    } catch (error) {
      console.error('[Cron] Scheduler error:', error);
    } finally {
      isCollecting = false;
    }
  });

  console.log('[Cron] Scheduler started - running every minute');
}

/**
 * 스케줄러 중지 (테스트/개발용)
 */
export function stopCronScheduler() {
  isRunning = false;
  console.log('[Cron] Scheduler stopped');
}
