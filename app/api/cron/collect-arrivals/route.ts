import { NextRequest, NextResponse } from 'next/server';
import { collectArrivals } from '@/lib/cron/collect-arrivals';
import { checkLastBusAlerts } from '@/lib/cron/last-bus-alert';

/**
 * Cron API 엔드포인트
 *
 * 사용 사례:
 * 1. Vercel Cron에서 호출 (vercel.json 설정 필요)
 * 2. systemd 타이머에서 curl로 호출
 * 3. 수동 테스트
 *
 * 보안: CRON_SECRET 환경변수로 인증 (선택)
 */
export async function GET(request: NextRequest) {
  // CRON_SECRET이 설정된 경우 인증 확인
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  try {
    const startTime = Date.now();

    // 1. 도착 정보 수집 및 자동 기록
    const arrivalResult = await collectArrivals();

    // 2. 막차 알림 체크 및 발송
    const lastBusResult = await checkLastBusAlerts();

    const duration = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      arrivals: {
        checked: arrivalResult.checked,
        logged: arrivalResult.logged,
        errors: arrivalResult.errors.length > 0 ? arrivalResult.errors : undefined,
      },
      lastBusAlerts: {
        checked: lastBusResult.checked,
        sent: lastBusResult.sent,
        errors: lastBusResult.errors.length > 0 ? lastBusResult.errors : undefined,
      },
    });
  } catch (error) {
    console.error('[Cron API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Vercel Cron 설정 (vercel.json에서 참조)
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 최대 60초
