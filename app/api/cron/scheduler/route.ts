import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  runManually,
  loadSchedulerSettings,
  saveSchedulerSettings,
  initSchedulerFromDB,
  getActiveTrackingCount,
} from '@/lib/cron/scheduler';

/**
 * 스케줄러 상태 조회
 * GET /api/cron/scheduler
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // DB 설정 불러오기 (모바일/웹 일관성)
  const dbSettings = await loadSchedulerSettings();
  const memoryStatus = getSchedulerStatus();

  // 메모리 상태와 DB 설정 동기화 확인
  // DB에서는 enabled인데 메모리에서 실행 중이 아니면 자동 시작
  if (dbSettings?.enabled && !memoryStatus.isRunning) {
    console.log('[Scheduler API] DB says enabled but not running, initializing...');
    await initSchedulerFromDB();
  }

  // DB 기반 활성 추적 대상 수 조회 (서버리스 환경 대응)
  const activeTrackingCount = await getActiveTrackingCount();

  return NextResponse.json({
    ...memoryStatus,
    // 메모리 기반 activeTimers가 0이면 DB 기반 값 사용
    activeTimers: memoryStatus.activeTimers > 0 ? memoryStatus.activeTimers : activeTrackingCount,
    activeTrackingTargets: activeTrackingCount,
    dbSettings,
  });
}

/**
 * 스케줄러 제어
 * POST /api/cron/scheduler
 * Body: { action: 'start' | 'stop' | 'run', intervalMinutes?: number }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, intervalMinutes = 5, startHour = 5, endHour = 24 } = body;

    switch (action) {
      case 'start':
        const started = startScheduler(intervalMinutes);
        if (started) {
          // DB에 설정 저장 (운영 시간 포함)
          await saveSchedulerSettings(true, intervalMinutes, startHour, endHour);
        }
        return NextResponse.json({
          success: started,
          message: started ? '스케줄러가 시작되었습니다.' : '스케줄러 시작 실패',
          ...getSchedulerStatus(),
        });

      case 'stop':
        const stopped = await stopScheduler();
        if (stopped) {
          // DB에 설정 저장 (현재 interval과 운영 시간 유지)
          const currentStatus = getSchedulerStatus();
          await saveSchedulerSettings(false, currentStatus.intervalMinutes, startHour, endHour);
        }
        return NextResponse.json({
          success: stopped,
          message: stopped ? '스케줄러가 중지되었습니다.' : '스케줄러 중지 실패',
          ...getSchedulerStatus(),
        });

      case 'run':
        const result = await runManually();
        return NextResponse.json({
          success: true,
          message: '수동 실행 완료',
          ...result,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, stop, or run' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Scheduler API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic';
