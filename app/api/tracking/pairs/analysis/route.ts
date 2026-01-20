import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';
import type { PairAnalysis, MatchedArrival, AnalysisIssue } from '@/types/stats';

// 중복 판단 기준 (5분 이내 같은 plate_no)
const DUPLICATE_THRESHOLD_MS = 5 * 60 * 1000;

// 최대 소요시간 (6시간) - 같은 날이어도 다른 운행 매칭 방지
const MAX_TRAVEL_TIME_MS = 6 * 60 * 60 * 1000;

// 날짜 문자열 추출 (KST 기준)
function getDateString(isoString: string): string {
  const date = new Date(isoString);
  // KST = UTC+9
  const kstDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kstDate.toISOString().slice(0, 10);
}

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

  // 4. 날짜별 첫차/막차 식별
  const firstArrivalByDateA = new Map<string, string>(); // date -> id
  const lastArrivalByDateB = new Map<string, string>();  // date -> id

  for (const arrival of arrivalsA) {
    const dateStr = getDateString(arrival.arrival_time);
    if (!firstArrivalByDateA.has(dateStr)) {
      firstArrivalByDateA.set(dateStr, arrival.id);
    }
  }

  for (const arrival of arrivalsB) {
    const dateStr = getDateString(arrival.arrival_time);
    lastArrivalByDateB.set(dateStr, arrival.id); // 마지막 것으로 덮어쓰기
  }

  const excludedAIds = new Set(firstArrivalByDateA.values());
  const excludedBIds = new Set(lastArrivalByDateB.values());

  // 5. plate_no로 매칭 + 이슈 기록
  const matchedArrivals: MatchedArrival[] = [];
  const matchedBIds = new Set<string>();
  const matchedAIds = new Set<string>();
  const issues: AnalysisIssue[] = [];

  // 5-1. 중복 기록 체크 (A 정류장)
  for (let i = 0; i < arrivalsA.length; i++) {
    const current = arrivalsA[i];
    if (!current.plate_no) continue;

    for (let j = i + 1; j < arrivalsA.length; j++) {
      const next = arrivalsA[j];
      if (current.plate_no !== next.plate_no) continue;

      const timeDiff = new Date(next.arrival_time).getTime() - new Date(current.arrival_time).getTime();
      if (timeDiff > 0 && timeDiff <= DUPLICATE_THRESHOLD_MS) {
        issues.push({
          type: 'duplicate',
          description: `중복 기록: ${current.plate_no} (${Math.round(timeDiff / 1000)}초 간격)`,
          station: 'A',
          plateNo: current.plate_no,
          arrivalTime: next.arrival_time,
          details: `이전: ${current.arrival_time}`,
        });
      }
    }
  }

  // 5-2. 중복 기록 체크 (B 정류장)
  for (let i = 0; i < arrivalsB.length; i++) {
    const current = arrivalsB[i];
    if (!current.plate_no) continue;

    for (let j = i + 1; j < arrivalsB.length; j++) {
      const next = arrivalsB[j];
      if (current.plate_no !== next.plate_no) continue;

      const timeDiff = new Date(next.arrival_time).getTime() - new Date(current.arrival_time).getTime();
      if (timeDiff > 0 && timeDiff <= DUPLICATE_THRESHOLD_MS) {
        issues.push({
          type: 'duplicate',
          description: `중복 기록: ${current.plate_no} (${Math.round(timeDiff / 1000)}초 간격)`,
          station: 'B',
          plateNo: current.plate_no,
          arrivalTime: next.arrival_time,
          details: `이전: ${current.arrival_time}`,
        });
      }
    }
  }

  // 5-3. plate_no 없음 체크 및 첫차 체크 (A)
  for (const arrivalA of arrivalsA) {
    if (!arrivalA.plate_no) {
      issues.push({
        type: 'no_plate',
        description: 'plate_no 없음',
        station: 'A',
        plateNo: null,
        arrivalTime: arrivalA.arrival_time,
      });
    }
    if (excludedAIds.has(arrivalA.id) && arrivalA.plate_no) {
      issues.push({
        type: 'boundary',
        description: '첫차 (분석 제외)',
        station: 'A',
        plateNo: arrivalA.plate_no,
        arrivalTime: arrivalA.arrival_time,
        details: `날짜: ${getDateString(arrivalA.arrival_time)}`,
      });
    }
  }

  // 5-4. plate_no 없음 체크 및 막차 체크 (B)
  for (const arrivalB of arrivalsB) {
    if (!arrivalB.plate_no) {
      issues.push({
        type: 'no_plate',
        description: 'plate_no 없음',
        station: 'B',
        plateNo: null,
        arrivalTime: arrivalB.arrival_time,
      });
    }
    if (excludedBIds.has(arrivalB.id) && arrivalB.plate_no) {
      issues.push({
        type: 'boundary',
        description: '막차 (분석 제외)',
        station: 'B',
        plateNo: arrivalB.plate_no,
        arrivalTime: arrivalB.arrival_time,
        details: `날짜: ${getDateString(arrivalB.arrival_time)}`,
      });
    }
  }

  // 5-5. 매칭 시도 (같은 날만, 첫차/막차 제외)
  for (const arrivalA of arrivalsA) {
    if (!arrivalA.plate_no) continue;
    if (excludedAIds.has(arrivalA.id)) continue; // 첫차 제외

    const arrivalATime = new Date(arrivalA.arrival_time).getTime();
    const arrivalADate = getDateString(arrivalA.arrival_time);
    let matched = false;
    let diffDayMatch: { arrivalB: typeof arrivalsB[0]; timeDiff: number } | null = null;

    for (const arrivalB of arrivalsB) {
      if (!arrivalB.plate_no) continue;
      if (matchedBIds.has(arrivalB.id)) continue;
      if (excludedBIds.has(arrivalB.id)) continue; // 막차 제외

      const arrivalBTime = new Date(arrivalB.arrival_time).getTime();
      const arrivalBDate = getDateString(arrivalB.arrival_time);
      const timeDiff = arrivalBTime - arrivalATime;

      // 같은 plate_no이고 B가 A보다 늦어야 함
      if (arrivalA.plate_no === arrivalB.plate_no && timeDiff > 0) {
        // 같은 날인지 체크
        if (arrivalADate === arrivalBDate) {
          // 6시간 이내인지 체크
          if (timeDiff <= MAX_TRAVEL_TIME_MS) {
            // 같은 날 + 6시간 이내 → 매칭 성공
            const travelTimeMinutes = Math.round(timeDiff / (1000 * 60));
            matchedArrivals.push({
              plateNo: arrivalA.plate_no,
              arrivalAtA: arrivalA.arrival_time,
              arrivalAtB: arrivalB.arrival_time,
              travelTimeMinutes,
            });
            matchedBIds.add(arrivalB.id);
            matchedAIds.add(arrivalA.id);
            matched = true;
            break;
          }
          // 같은 날이지만 6시간 초과 → 다른 운행으로 간주, 다음 B 도착 찾기
        } else {
          // 다른 날 매칭 - 기록만 함
          if (!diffDayMatch || timeDiff < diffDayMatch.timeDiff) {
            diffDayMatch = { arrivalB, timeDiff };
          }
        }
      }
    }

    // 매칭 안 됨 기록
    if (!matched) {
      if (diffDayMatch) {
        issues.push({
          type: 'diff_day',
          description: `다른 날 매칭: ${getDateString(diffDayMatch.arrivalB.arrival_time)}`,
          station: 'A',
          plateNo: arrivalA.plate_no,
          arrivalTime: arrivalA.arrival_time,
          details: `B 도착: ${diffDayMatch.arrivalB.arrival_time}`,
        });
      } else {
        // B에서 같은 plate_no가 전혀 없음
        const existsInB = arrivalsB.some((b) => b.plate_no === arrivalA.plate_no && !excludedBIds.has(b.id));
        issues.push({
          type: 'unmatched',
          description: existsInB
            ? 'B 도착 기록 있으나 시간 순서 불일치'
            : 'B 정류장에 도착 기록 없음 (막차 제외)',
          station: 'A',
          plateNo: arrivalA.plate_no,
          arrivalTime: arrivalA.arrival_time,
        });
      }
    }
  }

  // 6. 통계 계산
  const travelTimes = matchedArrivals.map((m) => m.travelTimeMinutes);
  // 분석 대상: plate_no 있고 첫차가 아닌 A 도착
  const analysisTargetA = arrivalsA.filter((a) => a.plate_no && !excludedAIds.has(a.id)).length;
  const missingAtB = analysisTargetA - matchedArrivals.length;

  // 이슈 요약
  const issuesSummary = {
    duplicates: issues.filter((i) => i.type === 'duplicate').length,
    unmatched: issues.filter((i) => i.type === 'unmatched').length,
    noPlateNo: issues.filter((i) => i.type === 'no_plate').length,
    timeout: 0, // deprecated
    boundary: issues.filter((i) => i.type === 'boundary').length,
    diffDay: issues.filter((i) => i.type === 'diff_day').length,
  };

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
    matchRate: analysisTargetA > 0
      ? Math.round((matchedArrivals.length / analysisTargetA) * 100)
      : 0,

    // 최근 매칭 기록 (최신 10개)
    recentMatches: matchedArrivals.slice(-10).reverse(),

    // 분석 이슈 (최근 50개, 디버깅용)
    issues: issues.slice(-50),
    issuesSummary,
  };

  return successResponse({ analysis });
}
