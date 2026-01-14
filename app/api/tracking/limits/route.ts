import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';

const MAX_STATIONS = 10;
const MAX_TARGETS = 20;

// GET: 추적 대상 제한 상태 조회
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  // 활성화된 고유 정류소 수
  const { data: stationData, error: stationError } = await supabase
    .from('bus_tracking_targets')
    .select('station_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (stationError) {
    return ApiErrors.internalError('정류소 수 조회에 실패했습니다.', stationError.message);
  }

  const uniqueStations = new Set(stationData?.map(d => d.station_id) || []);
  const stationCount = uniqueStations.size;

  // 활성화된 총 추적 대상 수
  const { count: targetCount, error: targetError } = await supabase
    .from('bus_tracking_targets')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true);

  if (targetError) {
    return ApiErrors.internalError('추적 대상 수 조회에 실패했습니다.', targetError.message);
  }

  return successResponse({
    limits: {
      stations: {
        current: stationCount,
        max: MAX_STATIONS,
        available: MAX_STATIONS - stationCount,
        exceeded: stationCount >= MAX_STATIONS,
      },
      targets: {
        current: targetCount || 0,
        max: MAX_TARGETS,
        available: MAX_TARGETS - (targetCount || 0),
        exceeded: (targetCount || 0) >= MAX_TARGETS,
      },
    },
  });
}
