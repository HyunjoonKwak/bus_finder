/**
 * Next.js Instrumentation Hook
 * 서버 시작 시 node-cron 스케줄러를 실행합니다.
 *
 * 참고: next.config.ts에서 experimental.instrumentationHook: true 필요
 */
export async function register() {
  // Node.js 런타임에서만 실행 (Edge 런타임 제외)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // 개발 환경에서는 Hot Reload로 인해 중복 실행될 수 있으므로
    // 환경변수로 Cron 활성화 여부를 제어
    const cronEnabled = process.env.ENABLE_CRON !== 'false';

    if (cronEnabled) {
      try {
        const { startCronScheduler } = await import('./lib/cron/scheduler');
        startCronScheduler();
      } catch (error) {
        console.error('[Instrumentation] Failed to start cron scheduler:', error);
      }
    } else {
      console.log('[Instrumentation] Cron scheduler disabled by ENABLE_CRON=false');
    }
  }
}
