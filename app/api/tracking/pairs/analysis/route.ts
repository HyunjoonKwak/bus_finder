import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';
import type { PairAnalysis, MatchedArrival } from '@/types/stats';

// 표준편차 계산
function calculateStdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(Math.sqrt(variance) * 10) / 10;
}

/**
 * GET /api/tracking/pairs/analysis
 * 페어 정류장 분석
 * Query: pairId, days (기본 30)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const pairId = searchParams.get('pairId');
  const days = parseInt(searchParams.get('days') || '30', 10);

  if (!pairId) {
    return ApiErrors.badRequest('페어 ID가 필요합니다.');
  }

  // 1. 페어 정보 조회
  const { data: pair, error: pairError } = await supabase
    .from('station_pairs')
    .select('*')
    .eq('id', pairId)
    .eq('user_id', user.id)
    .single();

  if (pairError || !pair) {
    return ApiErrors.notFound('페어를 찾을 수 없습니다.');
  }

  const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // 2. 정류장 A 도착 기록 조회
  const { data: logsA, error: logsAError } = await supabase
    .from('bus_arrival_logs')
    .select('id, arrival_time, plate_no')
    .eq('user_id', user.id)
    .eq('bus_id', pair.bus_id)
    .eq('station_id', pair.station_a_id)
    .gte('arrival_time', dateThreshold)
    .order('arrival_time', { ascending: true });

  if (logsAError) {
    return ApiErrors.internalError('A 정류장 데이터 조회 실패', logsAError.message);
  }

  // 3. 정류장 B 도착 기록 조회
  const { data: logsB, error: logsBError } = await supabase
    .from('bus_arrival_logs')
    .select('id, arrival_time, plate_no')
    .eq('user_id', user.id)
    .eq('bus_id', pair.bus_id)
    .eq('station_id', pair.station_b_id)
    .gte('arrival_time', dateThreshold)
    .order('arrival_time', { ascending: true });

  if (logsBError) {
    return ApiErrors.internalError('B 정류장 데이터 조회 실패', logsBError.message);
  }

  const arrivalsA = logsA || [];
  const arrivalsB = logsB || [];

  // 4. plate_no로 매칭
  const matchedArrivals: MatchedArrival[] = [];
  const matchedBIds = new Set<string>();

  for (const arrivalA of arrivalsA) {
    if (!arrivalA.plate_no) continue;

    // A 도착 이후 B 도착 중에서 같은 plate_no 찾기
    // (A 도착 후 6시간 이내의 B 도착만 유효 - 회차 노선 고려)
    const arrivalATime = new Date(arrivalA.arrival_time).getTime();
    const maxWaitTime = 6 * 60 * 60 * 1000; // 6시간

    for (const arrivalB of arrivalsB) {
      if (!arrivalB.plate_no) continue;
      if (matchedBIds.has(arrivalB.id)) continue;

      const arrivalBTime = new Date(arrivalB.arrival_time).getTime();
      const timeDiff = arrivalBTime - arrivalATime;

      // B가 A보다 늦고, 1시간 이내인 경우만 매칭
      if (timeDiff > 0 && timeDiff <= maxWaitTime) {
        if (arrivalA.plate_no === arrivalB.plate_no) {
          const travelTimeMinutes = Math.round(timeDiff / (1000 * 60));
          matchedArrivals.push({
            plateNo: arrivalA.plate_no,
            arrivalAtA: arrivalA.arrival_time,
            arrivalAtB: arrivalB.arrival_time,
            travelTimeMinutes,
          });
          matchedBIds.add(arrivalB.id);
          break; // 하나의 A에 대해 하나의 B만 매칭
        }
      }
    }
  }

  // 5. 통계 계산
  const travelTimes = matchedArrivals.map((m) => m.travelTimeMinutes);
  const arrivalsWithPlateNo = arrivalsA.filter((a) => a.plate_no).length;
  const missingAtB = arrivalsWithPlateNo - matchedArrivals.length;

  const analysis: PairAnalysis = {
    pairId: pair.id,
    busNo: pair.bus_no,
    stationA: pair.station_a_name,
    stationB: pair.station_b_name,
    period: `최근 ${days}일`,

    // 소요시간 통계
    avgTravelTime: travelTimes.length > 0
      ? Math.round(travelTimes.reduce((a, b) => a + b, 0) / travelTimes.length)
      : null,
    minTravelTime: travelTimes.length > 0 ? Math.min(...travelTimes) : null,
    maxTravelTime: travelTimes.length > 0 ? Math.max(...travelTimes) : null,
    stdDevTravelTime: calculateStdDev(travelTimes),

    // 매칭/누락 통계
    totalArrivalsAtA: arrivalsA.length,
    totalArrivalsAtB: arrivalsB.length,
    matchedCount: matchedArrivals.length,
    missingAtB: Math.max(0, missingAtB),
    matchRate: arrivalsWithPlateNo > 0
      ? Math.round((matchedArrivals.length / arrivalsWithPlateNo) * 100)
      : 0,

    // 최근 매칭 기록 (최신 10개)
    recentMatches: matchedArrivals.slice(-10).reverse(),
  };

  return successResponse({ analysis });
}
