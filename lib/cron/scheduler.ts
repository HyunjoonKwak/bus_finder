import cron, { ScheduledTask } from 'node-cron';
import { collectArrivals } from './collect-arrivals';
import { checkLastBusAlerts } from './last-bus-alert';

interface SchedulerState {
  isRunning: boolean;
  task: ScheduledTask | null;
  isCollecting: boolean;
  lastRun: Date | null;
  lastResult: {
    arrivals: { checked: number; logged: number };
    lastBusAlerts: { checked: number; sent: number };
  } | null;
  intervalMinutes: number;
}

// 싱글톤 상태
const state: SchedulerState = {
  isRunning: false,
  task: null,
  isCollecting: false,
  lastRun: null,
  lastResult: null,
  intervalMinutes: 5,
};

/**
 * Cron 작업 실행
 */
async function runCronJob() {
  if (state.isCollecting) {
    console.log('[Scheduler] Previous job still running, skipping...');
    return;
  }

  state.isCollecting = true;
  const startTime = Date.now();

  try {
    console.log('[Scheduler] Running cron job at', new Date().toISOString());

    const arrivalResult = await collectArrivals();
    const lastBusResult = await checkLastBusAlerts();

    state.lastRun = new Date();
    state.lastResult = {
      arrivals: {
        checked: arrivalResult.checked,
        logged: arrivalResult.logged,
      },
      lastBusAlerts: {
        checked: lastBusResult.checked,
        sent: lastBusResult.sent,
      },
    };

    const duration = Date.now() - startTime;
    console.log(`[Scheduler] Done in ${duration}ms:`, state.lastResult);
  } catch (error) {
    console.error('[Scheduler] Cron job error:', error);
  } finally {
    state.isCollecting = false;
  }
}

/**
 * 스케줄러 시작
 * @param intervalMinutes 실행 간격 (분)
 */
export function startScheduler(intervalMinutes = 5): boolean {
  if (state.isRunning) {
    console.log('[Scheduler] Already running');
    return true;
  }

  const cronExpression = `*/${intervalMinutes} * * * *`;

  if (!cron.validate(cronExpression)) {
    console.error('[Scheduler] Invalid cron expression:', cronExpression);
    return false;
  }

  state.task = cron.schedule(cronExpression, runCronJob, {
    timezone: 'Asia/Seoul',
  });

  state.isRunning = true;
  state.intervalMinutes = intervalMinutes;
  console.log('[Scheduler] Started - running every', intervalMinutes, 'minutes');

  // 시작 시 즉시 한 번 실행
  runCronJob();

  return true;
}

/**
 * 스케줄러 중지
 */
export function stopScheduler(): boolean {
  if (!state.isRunning || !state.task) {
    console.log('[Scheduler] Not running');
    return true;
  }

  state.task.stop();
  state.task = null;
  state.isRunning = false;
  console.log('[Scheduler] Stopped');

  return true;
}

/**
 * 스케줄러 상태 조회
 */
export function getSchedulerStatus() {
  return {
    isRunning: state.isRunning,
    intervalMinutes: state.intervalMinutes,
    lastRun: state.lastRun?.toISOString() || null,
    lastResult: state.lastResult,
  };
}

/**
 * 수동으로 Cron 작업 실행
 */
export async function runManually() {
  await runCronJob();
  return getSchedulerStatus();
}

// 레거시 호환
export const startCronScheduler = () => startScheduler(1);
export const stopCronScheduler = stopScheduler;
