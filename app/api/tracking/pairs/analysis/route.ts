import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';
import type { PairAnalysis, MatchedArrival, AnalysisIssue } from '@/types/stats';

// 중복 판단 기준 (5분 이내 같은 plate_no)
const DUPLICATE_THRESHOLD_MS = 5 * 60 * 1000;

// 최대 소요시간 (6시간) - 같은 날이어도 다른 운행 매칭 방지
const MAX_TRAVEL_TIME_MS = 6 * 60 * 60 * 1000;

// 운영 시간 설정 (04:00 기준 - 버스는 새벽 4시 전후로 운행 종료/시작)
const OPERATION_DAY_START_HOUR = 4;

// 자정 전후 허용 시간대 (23:00 ~ 01:00)
const MIDNIGHT_CROSSING_START_HOUR = 23;
const MIDNIGHT_CROSSING_END_HOUR = 1;

// KST 날짜/시간 헬퍼 (UTC 기준으로 계산하여 toISOString 이슈 방지)
function getKSTDate(isoString: string): { year: number; month: number; day: number; hour: number } {
  const date = new Date(isoString);
  // UTC 시간에 9시간 더해서 KST 계산
  let hour = date.getUTCHours() + 9;
  let day = date.getUTCDate();
  let month = date.getUTCMonth() + 1;
  let year = date.getUTCFullYear();

  // 24시 넘으면 다음 날
  if (hour >= 24) {
    hour -= 24;
    day += 1;
    // 월말 처리
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) {
      day = 1;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  return { year, month, day, hour };
}

// 운영일 기준 날짜 추출 (KST, 04:00 기준)
// 04:00 이전이면 전날로 처리 (23:50 A출발 → 00:20 B도착 = 같은 운영일)
function getOperationDateString(isoString: string): string {
  const kst = getKSTDate(isoString);
  let { year, month, day } = kst;

  // 04:00 이전이면 전날로 처리
  if (kst.hour < OPERATION_DAY_START_HOUR) {
    day -= 1;
    if (day < 1) {
      month -= 1;
      if (month < 1) {
        month = 12;
        year -= 1;
      }
      day = new Date(year, month, 0).getDate();
    }
  }

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// 기존 날짜 문자열 추출 (디버깅용)
function getDateString(isoString: string): string {
  const kst = getKSTDate(isoString);
  return `${kst.year}-${String(kst.month).padStart(2, '0')}-${String(kst.day).padStart(2, '0')}`;
}

// KST 시간 추출
function getKSTHour(isoString: string): number {
  return getKSTDate(isoString).hour;
}

// 자정 전후 시간대인지 확인
function isMidnightCrossingTime(isoString: string): boolean {
  const hour = getKSTHour(isoString);
  return hour >= MIDNIGHT_CROSSING_START_HOUR || hour <= MIDNIGHT_CROSSING_END_HOUR;
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
  const issues: AnalysisIssue[] = [];

  // 1.5. A/B 양방향 추적 상태 확인
  const { data: trackingTargets } = await supabase
    .from('bus_tracking_targets')
    .select('station_id, is_active')
    .eq('user_id', user.id)
    .eq('bus_id', pair.bus_id)
    .in('station_id', [pair.station_a_id, pair.station_b_id]);

  const isATracked = trackingTargets?.some(t =>
    t.station_id === pair.station_a_id && t.is_active) ?? false;
  const isBTracked = trackingTargets?.some(t =>
    t.station_id === pair.station_b_id && t.is_active) ?? false;

  // 추적 미설정 경고
  if (!isATracked || !isBTracked) {
    issues.push({
      type: 'config_warning',
      description: `추적 미설정: A=${isATracked ? '활성' : '비활성'}, B=${isBTracked ? '활성' : '비활성'}`,
      station: 'system',
      plateNo: null,
      arrivalTime: new Date().toISOString(),
      details: '양쪽 정류장 모두 추적해야 매칭률이 높아집니다.',
    });
  }

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

  // 4. 운영일(04:00 기준) 기반 첫차/막차 식별 + 소프트 경계
  const firstArrivalByOpDateA = new Map<string, string>(); // opDate -> id
  const lastArrivalByOpDateB = new Map<string, string>();  // opDate -> id
  const boundaryConfidenceA = new Map<string, 'hard' | 'soft'>(); // id -> 경계 유형
  const boundaryConfidenceB = new Map<string, 'hard' | 'soft'>(); // id -> 경계 유형

  // 운영 시작/종료 시간대 판단 (소프트 경계용)
  const EARLY_MORNING_END = 6;   // 06:00 이전 = 확실한 첫차
  const LATE_NIGHT_START = 22;   // 22:00 이후 = 확실한 막차

  for (const arrival of arrivalsA) {
    const opDateStr = getOperationDateString(arrival.arrival_time);
    const hour = getKSTHour(arrival.arrival_time);

    if (!firstArrivalByOpDateA.has(opDateStr)) {
      firstArrivalByOpDateA.set(opDateStr, arrival.id);
      // 06:00 이전이면 hard boundary (확실한 첫차), 아니면 soft (추적 시작점일 수 있음)
      boundaryConfidenceA.set(arrival.id, hour < EARLY_MORNING_END ? 'hard' : 'soft');
    }
  }

  for (const arrival of arrivalsB) {
    const opDateStr = getOperationDateString(arrival.arrival_time);
    const hour = getKSTHour(arrival.arrival_time);

    // 마지막 것으로 덮어쓰기
    const prevId = lastArrivalByOpDateB.get(opDateStr);
    if (prevId) {
      boundaryConfidenceB.delete(prevId);
    }
    lastArrivalByOpDateB.set(opDateStr, arrival.id);
    // 22:00 이후면 hard boundary (확실한 막차), 아니면 soft
    boundaryConfidenceB.set(arrival.id, hour >= LATE_NIGHT_START ? 'hard' : 'soft');
  }

  // 소프트 경계는 분석에 포함하되 신뢰도 낮음으로 표시
  const hardExcludedAIds = new Set<string>();
  const softExcludedAIds = new Set<string>();
  const hardExcludedBIds = new Set<string>();
  const softExcludedBIds = new Set<string>();

  for (const [id, type] of boundaryConfidenceA) {
    if (type === 'hard') hardExcludedAIds.add(id);
    else softExcludedAIds.add(id);
  }

  for (const [id, type] of boundaryConfidenceB) {
    if (type === 'hard') hardExcludedBIds.add(id);
    else softExcludedBIds.add(id);
  }

  // 5. plate_no로 매칭 + 이슈 기록
  const matchedArrivals: MatchedArrival[] = [];
  const matchedBIds = new Set<string>();
  const matchedAIds = new Set<string>();

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
    // 소프트/하드 경계 구분하여 이슈 기록
    if (hardExcludedAIds.has(arrivalA.id) && arrivalA.plate_no) {
      issues.push({
        type: 'boundary',
        description: '첫차 (분석 제외 - 확실)',
        station: 'A',
        plateNo: arrivalA.plate_no,
        arrivalTime: arrivalA.arrival_time,
        details: `운영일: ${getOperationDateString(arrivalA.arrival_time)}, 시간: ${getKSTHour(arrivalA.arrival_time)}시`,
      });
    } else if (softExcludedAIds.has(arrivalA.id) && arrivalA.plate_no) {
      issues.push({
        type: 'boundary',
        description: '첫차 (신뢰도 낮음 - 추적 시작점)',
        station: 'A',
        plateNo: arrivalA.plate_no,
        arrivalTime: arrivalA.arrival_time,
        details: `운영일: ${getOperationDateString(arrivalA.arrival_time)}, 시간: ${getKSTHour(arrivalA.arrival_time)}시`,
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
    // 소프트/하드 경계 구분
    if (hardExcludedBIds.has(arrivalB.id) && arrivalB.plate_no) {
      issues.push({
        type: 'boundary',
        description: '막차 (분석 제외 - 확실)',
        station: 'B',
        plateNo: arrivalB.plate_no,
        arrivalTime: arrivalB.arrival_time,
        details: `운영일: ${getOperationDateString(arrivalB.arrival_time)}, 시간: ${getKSTHour(arrivalB.arrival_time)}시`,
      });
    } else if (softExcludedBIds.has(arrivalB.id) && arrivalB.plate_no) {
      issues.push({
        type: 'boundary',
        description: '막차 (신뢰도 낮음 - 추적 종료점)',
        station: 'B',
        plateNo: arrivalB.plate_no,
        arrivalTime: arrivalB.arrival_time,
        details: `운영일: ${getOperationDateString(arrivalB.arrival_time)}, 시간: ${getKSTHour(arrivalB.arrival_time)}시`,
      });
    }
  }

  // 5-5. 최적 매칭 알고리즘 (점수 기반)
  // 모든 가능한 A-B 매칭 쌍 생성 후 최적 선택
  interface MatchCandidate {
    aIndex: number;
    bIndex: number;
    aId: string;
    bId: string;
    plateNo: string;
    timeDiff: number;
    score: number;
    confidence: 'high' | 'medium' | 'low';
    confidenceReason: string;
    isMidnightCrossing: boolean;
  }

  const matchCandidates: MatchCandidate[] = [];

  // 예상 평균 소요시간 (이전 매칭 기반, 없으면 230분 기본값 - 버스 회차 시간)
  const DEFAULT_EXPECTED_TRAVEL_TIME = 230;

  for (let aIndex = 0; aIndex < arrivalsA.length; aIndex++) {
    const arrivalA = arrivalsA[aIndex];
    if (!arrivalA.plate_no) continue;
    // 하드 경계만 완전 제외, 소프트 경계는 신뢰도 낮음으로 포함
    if (hardExcludedAIds.has(arrivalA.id)) continue;

    const arrivalATime = new Date(arrivalA.arrival_time).getTime();
    const arrivalAOpDate = getOperationDateString(arrivalA.arrival_time);
    const isASoftBoundary = softExcludedAIds.has(arrivalA.id);
    const isAMidnightTime = isMidnightCrossingTime(arrivalA.arrival_time);

    for (let bIndex = 0; bIndex < arrivalsB.length; bIndex++) {
      const arrivalB = arrivalsB[bIndex];
      if (!arrivalB.plate_no) continue;
      if (hardExcludedBIds.has(arrivalB.id)) continue;

      const arrivalBTime = new Date(arrivalB.arrival_time).getTime();
      const arrivalBOpDate = getOperationDateString(arrivalB.arrival_time);
      const timeDiff = arrivalBTime - arrivalATime;
      const isBSoftBoundary = softExcludedBIds.has(arrivalB.id);

      // 같은 plate_no이고 B가 A보다 늦어야 함
      if (arrivalA.plate_no !== arrivalB.plate_no || timeDiff <= 0) continue;

      // 6시간 초과는 무조건 제외
      if (timeDiff > MAX_TRAVEL_TIME_MS) continue;

      // 운영일 기반 매칭 (같은 운영일 또는 자정 전후 허용)
      const isSameOpDay = arrivalAOpDate === arrivalBOpDate;
      const isMidnightCrossing = !isSameOpDay && isAMidnightTime && timeDiff <= MAX_TRAVEL_TIME_MS;

      if (!isSameOpDay && !isMidnightCrossing) continue;

      // 점수 계산 (소요시간이 예상치에 가까울수록 높은 점수)
      const travelTimeMinutes = Math.round(timeDiff / (1000 * 60));
      const deviation = Math.abs(travelTimeMinutes - DEFAULT_EXPECTED_TRAVEL_TIME);
      const baseScore = 1000 - deviation; // 기본 점수

      // 신뢰도 및 보정 점수
      let confidence: 'high' | 'medium' | 'low' = 'high';
      let confidenceReason = '정상 매칭';
      let scoreAdjustment = 0;

      if (isASoftBoundary || isBSoftBoundary) {
        confidence = 'medium';
        confidenceReason = isASoftBoundary ? '첫 도착 (추적 시작점)' : '마지막 도착 (추적 종료점)';
        scoreAdjustment -= 100;
      }

      if (isMidnightCrossing) {
        if (confidence === 'high') {
          confidence = 'medium';
        } else {
          confidence = 'low';
        }
        confidenceReason += isMidnightCrossing ? ' + 자정 전후 매칭' : '';
        scoreAdjustment -= 50;
      }

      const finalScore = baseScore + scoreAdjustment;

      matchCandidates.push({
        aIndex,
        bIndex,
        aId: arrivalA.id,
        bId: arrivalB.id,
        plateNo: arrivalA.plate_no,
        timeDiff,
        score: finalScore,
        confidence,
        confidenceReason,
        isMidnightCrossing,
      });
    }
  }

  // 점수 높은 순으로 정렬 후 탐욕적 선택 (이미 매칭된 A/B는 제외)
  matchCandidates.sort((a, b) => b.score - a.score);

  for (const candidate of matchCandidates) {
    if (matchedAIds.has(candidate.aId) || matchedBIds.has(candidate.bId)) continue;

    const travelTimeMinutes = Math.round(candidate.timeDiff / (1000 * 60));
    const arrivalA = arrivalsA[candidate.aIndex];
    const arrivalB = arrivalsB[candidate.bIndex];

    matchedArrivals.push({
      plateNo: candidate.plateNo,
      arrivalAtA: arrivalA.arrival_time,
      arrivalAtB: arrivalB.arrival_time,
      travelTimeMinutes,
      confidence: candidate.confidence,
      confidenceReason: candidate.confidenceReason,
      isMidnightCrossing: candidate.isMidnightCrossing,
    });

    matchedAIds.add(candidate.aId);
    matchedBIds.add(candidate.bId);

    // 자정 전후 매칭 성공 이슈 기록
    if (candidate.isMidnightCrossing) {
      issues.push({
        type: 'midnight_match',
        description: `자정 전후 매칭 성공 (${travelTimeMinutes}분)`,
        station: 'A',
        plateNo: candidate.plateNo,
        arrivalTime: arrivalA.arrival_time,
        details: `B 도착: ${arrivalB.arrival_time}`,
      });
    }
  }

  // 매칭 안 된 A 도착에 대한 이슈 기록
  for (const arrivalA of arrivalsA) {
    if (!arrivalA.plate_no) continue;
    if (hardExcludedAIds.has(arrivalA.id)) continue;
    if (matchedAIds.has(arrivalA.id)) continue;

    // B에서 같은 plate_no 찾기 (다른 날 포함)
    const samePlateInB = arrivalsB.filter(b =>
      b.plate_no === arrivalA.plate_no &&
      !hardExcludedBIds.has(b.id) &&
      new Date(b.arrival_time).getTime() > new Date(arrivalA.arrival_time).getTime()
    );

    if (samePlateInB.length > 0) {
      const closestB = samePlateInB[0];
      const timeDiff = new Date(closestB.arrival_time).getTime() - new Date(arrivalA.arrival_time).getTime();

      if (timeDiff > MAX_TRAVEL_TIME_MS) {
        issues.push({
          type: 'diff_day',
          description: `시간 초과로 매칭 불가 (${Math.round(timeDiff / (1000 * 60))}분)`,
          station: 'A',
          plateNo: arrivalA.plate_no,
          arrivalTime: arrivalA.arrival_time,
          details: `B 도착: ${closestB.arrival_time}`,
        });
      } else {
        // 이미 다른 A와 매칭된 B일 수 있음
        issues.push({
          type: 'unmatched',
          description: 'B 도착 기록 있으나 다른 A와 매칭됨',
          station: 'A',
          plateNo: arrivalA.plate_no,
          arrivalTime: arrivalA.arrival_time,
          details: `가능한 B: ${closestB.arrival_time}`,
        });
      }
    } else {
      issues.push({
        type: 'unmatched',
        description: 'B 정류장에 도착 기록 없음',
        station: 'A',
        plateNo: arrivalA.plate_no,
        arrivalTime: arrivalA.arrival_time,
      });
    }
  }

  // 6. 통계 계산
  const travelTimes = matchedArrivals.map((m) => m.travelTimeMinutes);
  // 분석 대상: plate_no 있고 하드 경계(첫차)가 아닌 A 도착
  const analysisTargetA = arrivalsA.filter((a) => a.plate_no && !hardExcludedAIds.has(a.id)).length;
  const missingAtB = analysisTargetA - matchedArrivals.length;

  // 신뢰도 통계
  const confidenceStats = {
    high: matchedArrivals.filter(m => m.confidence === 'high').length,
    medium: matchedArrivals.filter(m => m.confidence === 'medium').length,
    low: matchedArrivals.filter(m => m.confidence === 'low').length,
  };

  // 이슈 요약
  const issuesSummary = {
    duplicates: issues.filter((i) => i.type === 'duplicate').length,
    unmatched: issues.filter((i) => i.type === 'unmatched').length,
    noPlateNo: issues.filter((i) => i.type === 'no_plate').length,
    timeout: 0, // deprecated
    boundary: issues.filter((i) => i.type === 'boundary').length,
    diffDay: issues.filter((i) => i.type === 'diff_day').length,
    configWarning: issues.filter((i) => i.type === 'config_warning').length,
    midnightMatch: issues.filter((i) => i.type === 'midnight_match').length,
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

    // 추적 상태 정보
    trackingStatus: {
      isATracked,
      isBTracked,
    },

    // 매칭 신뢰도 통계
    confidenceStats,
  };

  return successResponse({ analysis });
}
