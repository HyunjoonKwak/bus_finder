import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
  runManually,
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

  return NextResponse.json(getSchedulerStatus());
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
    const { action, intervalMinutes = 5 } = body;

    switch (action) {
      case 'start':
        const started = startScheduler(intervalMinutes);
        return NextResponse.json({
          success: started,
          message: started ? '스케줄러가 시작되었습니다.' : '스케줄러 시작 실패',
          ...getSchedulerStatus(),
        });

      case 'stop':
        const stopped = stopScheduler();
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
