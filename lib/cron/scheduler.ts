import cron, { ScheduledTask } from 'node-cron';
import { collectArrivals, scanAndSetupTimers } from './collect-arrivals';
import { checkLastBusAlerts } from './last-bus-alert';
import { createServiceClient } from '@/lib/supabase/service';
import { timerManager } from './dynamic-timer';

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
  initialized: boolean;
}

// 싱글톤 상태
const state: SchedulerState = {
  isRunning: false,
  task: null,
  isCollecting: false,
  lastRun: null,
  lastResult: null,
  intervalMinutes: 5,
  initialized: false,
};

/**
 * 현재 시간이 운영 시간 내인지 확인
 */
function isWithinOperatingHours(startHour: number, endHour: number): boolean {
  const now = new Date();
  // 한국 시간 기준
  const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const currentHour = koreaTime.getHours();

  // endHour가 24면 자정까지를 의미
  const effectiveEndHour = endHour === 24 ? 24 : endHour;

  // 예: startHour=5, endHour=24 → 05:00 ~ 23:59
  // 예: startHour=22, endHour=6 → 22:00 ~ 05:59 (야간 운영)
  if (startHour < effectiveEndHour) {
    // 일반적인 경우: 05:00 ~ 24:00
    return currentHour >= startHour && currentHour < effectiveEndHour;
  } else {
    // 야간 운영: 22:00 ~ 06:00
    return currentHour >= startHour || currentHour < effectiveEndHour;
  }
}

/**
 * 메인 타이머 실행 (15분마다)
 * - 전체 추적 대상 스캔
 * - 각 대상별 동적 타이머 설정/복구
 */
async function runMainTimer() {
  if (state.isCollecting) {
    console.log('[Scheduler] Previous job still running, skipping...');
    return;
  }

  // 운영 시간 체크
  const settings = await loadSchedulerSettings();
  if (settings) {
    const { startHour, endHour } = settings;
    if (!isWithinOperatingHours(startHour, endHour)) {
      const now = new Date();
      const koreaHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getHours();
      console.log(`[Scheduler] Outside operating hours (${startHour}:00-${endHour}:00), current: ${koreaHour}:00, skipping...`);
      // 운영 시간 외에는 모든 타이머 해제
      timerManager.clearAllTimers();
      return;
    }
  }

  state.isCollecting = true;
  const startTime = Date.now();

  try {
    console.log('[Scheduler] Running main timer at', new Date().toISOString());

    // 동적 타이머 방식: 전체 스캔 후 타이머 설정
    const scanResult = await scanAndSetupTimers();
    const lastBusResult = await checkLastBusAlerts();

    state.lastRun = new Date();
    state.lastResult = {
      arrivals: {
        checked: scanResult.checked,
        logged: scanResult.timersSet,
      },
      lastBusAlerts: {
        checked: lastBusResult.checked,
        sent: lastBusResult.sent,
      },
    };

    const duration = Date.now() - startTime;
    const activeTimers = timerManager.getActiveTimerCount();
    console.log(`[Scheduler] Done in ${duration}ms: ${scanResult.checked} checked, ${activeTimers} active timers`);
  } catch (error) {
    console.error('[Scheduler] Main timer error:', error);
  } finally {
    state.isCollecting = false;
  }
}

/**
 * 레거시: 기존 방식 Cron 작업 실행
 */
async function runCronJob() {
  if (state.isCollecting) {
    console.log('[Scheduler] Previous job still running, skipping...');
    return;
  }

  // 운영 시간 체크
  const settings = await loadSchedulerSettings();
  if (settings) {
    const { startHour, endHour } = settings;
    if (!isWithinOperatingHours(startHour, endHour)) {
      const now = new Date();
      const koreaHour = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' })).getHours();
      console.log(`[Scheduler] Outside operating hours (${startHour}:00-${endHour}:00), current: ${koreaHour}:00, skipping...`);
      return;
    }
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
 * 동적 타이머 스케줄러 시작 (권장)
 * - 메인 타이머: 15분 고정
 * - 동적 타이머: 각 추적 대상별 개별 관리
 */
export function startDynamicScheduler(): boolean {
  if (state.isRunning) {
    console.log('[Scheduler] Already running');
    return true;
  }

  // 메인 타이머: 15분 고정
  const cronExpression = '*/15 * * * *';

  state.task = cron.schedule(cronExpression, runMainTimer, {
    timezone: 'Asia/Seoul',
  });

  state.isRunning = true;
  state.intervalMinutes = 15;
  console.log('[Scheduler] Dynamic scheduler started - main timer every 15 minutes');

  // 시작 시 즉시 실행
  runMainTimer();

  return true;
}

/**
 * 레거시 스케줄러 시작
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

  // 동적 타이머도 모두 해제
  timerManager.clearAllTimers();

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
    // 동적 타이머 정보 추가
    activeTimers: timerManager.getActiveTimerCount(),
    timerDetails: timerManager.getTimerStatus(),
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

/**
 * DB에서 스케줄러 설정 불러오기
 */
export async function loadSchedulerSettings(): Promise<{
  enabled: boolean;
  intervalMinutes: number;
  startHour: number;
  endHour: number;
} | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from('scheduler_settings')
      .select('enabled, interval_minutes, start_hour, end_hour')
      .eq('key', 'arrival_collector')
      .single();

    if (error) {
      console.error('[Scheduler] Failed to load settings:', error.message);
      return null;
    }

    return {
      enabled: data.enabled,
      intervalMinutes: data.interval_minutes,
      startHour: data.start_hour ?? 5,
      endHour: data.end_hour ?? 24,
    };
  } catch (error) {
    console.error('[Scheduler] Error loading settings:', error);
    return null;
  }
}

/**
 * DB에 스케줄러 설정 저장
 */
export async function saveSchedulerSettings(
  enabled: boolean,
  intervalMinutes: number,
  startHour?: number,
  endHour?: number
): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const updateData: Record<string, unknown> = {
      enabled,
      interval_minutes: intervalMinutes,
      last_started_at: enabled ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    if (startHour !== undefined) updateData.start_hour = startHour;
    if (endHour !== undefined) updateData.end_hour = endHour;

    const { error } = await supabase
      .from('scheduler_settings')
      .update(updateData)
      .eq('key', 'arrival_collector');

    if (error) {
      console.error('[Scheduler] Failed to save settings:', error.message);
      return false;
    }

    console.log('[Scheduler] Settings saved:', { enabled, intervalMinutes, startHour, endHour });
    return true;
  } catch (error) {
    console.error('[Scheduler] Error saving settings:', error);
    return false;
  }
}

/**
 * 서버 시작 시 DB 설정에 따라 스케줄러 초기화
 * - 동적 타이머 방식 사용 (권장)
 */
export async function initSchedulerFromDB(): Promise<boolean> {
  if (state.initialized) {
    console.log('[Scheduler] Already initialized');
    return state.isRunning;
  }

  console.log('[Scheduler] Initializing from DB...');
  const settings = await loadSchedulerSettings();

  if (!settings) {
    console.log('[Scheduler] No settings found, skipping initialization');
    state.initialized = true;
    return false;
  }

  state.initialized = true;
  timerManager.setInitialized(true);

  if (settings.enabled) {
    console.log('[Scheduler] Auto-starting dynamic scheduler');
    // 동적 타이머 방식 사용
    return startDynamicScheduler();
  }

  console.log('[Scheduler] Settings loaded but disabled');
  return false;
}
