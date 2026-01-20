import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';

interface ArrivalLog {
  arrival_time: string;
  day_of_week: number;
}

interface DayPattern {
  count: number;
  avgMinutes: number; // 자정부터의 분
  stdDev: number;
  times: number[]; // 분 단위 시간들
}

interface Recommendation {
  targetId: string;
  busNo: string;
  stationName: string;
  recommendation: {
    departureTime: string; // HH:MM
    arrivalTime: string; // HH:MM (예상)
    confidence: 'high' | 'medium' | 'low';
    basis: string; // 추천 근거
    dataPoints: number; // 데이터 개수
  } | null;
  pattern: {
    avgTime: string;
    earliestTime: string;
    latestTime: string;
    stdDevMinutes: number;
  } | null;
}

/**
 * 최적 출발 시간 추천 API
 *
 * GET /api/tracking/recommend
 * Query params:
 * - targetId: 특정 추적 대상 (선택)
 * - bufferMinutes: 여유 시간 (기본: 5분)
 * - days: 분석할 기간 (기본: 30일)
 * - timeWindowStart: 시간대 필터 시작 (분 단위, 예: 420 = 07:00)
 * - timeWindowEnd: 시간대 필터 종료 (분 단위, 예: 540 = 09:00)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const targetId = searchParams.get('targetId');
  const bufferMinutes = parseInt(searchParams.get('bufferMinutes') || '5');
  const days = parseInt(searchParams.get('days') || '30');
  const timeWindowStart = searchParams.get('timeWindowStart') ? parseInt(searchParams.get('timeWindowStart')!) : null;
  const timeWindowEnd = searchParams.get('timeWindowEnd') ? parseInt(searchParams.get('timeWindowEnd')!) : null;

  try {
    // 1. 추적 대상 조회
    let targetsQuery = supabase
      .from('bus_tracking_targets')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (targetId) {
      targetsQuery = targetsQuery.eq('id', targetId);
    }

    const { data: targets, error: targetsError } = await targetsQuery;

    if (targetsError) {
      return ApiErrors.internalError(targetsError.message);
    }

    if (!targets || targets.length === 0) {
      return successResponse({ recommendations: [] });
    }

    // 2. 오늘 요일
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=일, 1=월, ..., 6=토
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    // 3. 각 추적 대상에 대한 추천 계산
    const recommendations: Recommendation[] = [];

    for (const target of targets) {
      // 해당 버스/정류소의 도착 기록 조회
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const { data: logs, error: logsError } = await supabase
        .from('bus_arrival_logs')
        .select('arrival_time, day_of_week')
        .eq('user_id', user.id)
        .eq('bus_id', target.bus_id)
        .eq('station_id', target.station_id)
        .gte('created_at', cutoffDate.toISOString())
        .order('arrival_time', { ascending: true });

      if (logsError || !logs || logs.length === 0) {
        recommendations.push({
          targetId: target.id,
          busNo: target.bus_no,
          stationName: target.station_name,
          recommendation: null,
          pattern: null,
        });
        continue;
      }

      // 4. 요일별 패턴 분석 (시간대 필터 적용)
      const dayPatterns = analyzeDayPatterns(logs as ArrivalLog[], timeWindowStart, timeWindowEnd);
      const todayPattern = dayPatterns[dayOfWeek];

      // 5. 추천 계산
      let recommendation: Recommendation['recommendation'] = null;
      let pattern: Recommendation['pattern'] = null;

      if (todayPattern && todayPattern.count >= 3) {
        // 충분한 데이터가 있는 경우
        const avgMinutes = todayPattern.avgMinutes;
        const departureMinutes = Math.max(0, avgMinutes - bufferMinutes);

        // 신뢰도 계산
        let confidence: 'high' | 'medium' | 'low';
        if (todayPattern.count >= 10 && todayPattern.stdDev <= 10) {
          confidence = 'high';
        } else if (todayPattern.count >= 5 && todayPattern.stdDev <= 20) {
          confidence = 'medium';
        } else {
          confidence = 'low';
        }

        recommendation = {
          departureTime: minutesToTime(departureMinutes),
          arrivalTime: minutesToTime(avgMinutes),
          confidence,
          basis: `${dayNames[dayOfWeek]}요일 ${todayPattern.count}회 기록 기준`,
          dataPoints: todayPattern.count,
        };

        const minTime = Math.min(...todayPattern.times);
        const maxTime = Math.max(...todayPattern.times);

        pattern = {
          avgTime: minutesToTime(avgMinutes),
          earliestTime: minutesToTime(minTime),
          latestTime: minutesToTime(maxTime),
          stdDevMinutes: Math.round(todayPattern.stdDev),
        };
      } else if (todayPattern && todayPattern.count > 0) {
        // 데이터가 부족한 경우 - 있는 데이터로 추천
        const avgMinutes = todayPattern.avgMinutes;
        const departureMinutes = Math.max(0, avgMinutes - bufferMinutes);

        recommendation = {
          departureTime: minutesToTime(departureMinutes),
          arrivalTime: minutesToTime(avgMinutes),
          confidence: 'low',
          basis: `${dayNames[dayOfWeek]}요일 ${todayPattern.count}회 기록 (데이터 부족)`,
          dataPoints: todayPattern.count,
        };

        pattern = {
          avgTime: minutesToTime(avgMinutes),
          earliestTime: minutesToTime(Math.min(...todayPattern.times)),
          latestTime: minutesToTime(Math.max(...todayPattern.times)),
          stdDevMinutes: Math.round(todayPattern.stdDev || 0),
        };
      } else {
        // 오늘 요일 데이터가 없는 경우 - 전체 평균 사용 (시간대 필터 적용)
        const allTimes = logs
          .map(log => {
            const date = new Date(log.arrival_time);
            return date.getHours() * 60 + date.getMinutes();
          })
          .filter(minutes => {
            if (timeWindowStart !== null && timeWindowEnd !== null) {
              return minutes >= timeWindowStart && minutes <= timeWindowEnd;
            }
            return true;
          });

        if (allTimes.length > 0) {
          const avgMinutes = Math.round(allTimes.reduce((a, b) => a + b, 0) / allTimes.length);
          const departureMinutes = Math.max(0, avgMinutes - bufferMinutes);

          recommendation = {
            departureTime: minutesToTime(departureMinutes),
            arrivalTime: minutesToTime(avgMinutes),
            confidence: 'low',
            basis: `전체 ${allTimes.length}회 기록 평균 (${dayNames[dayOfWeek]}요일 데이터 없음)`,
            dataPoints: allTimes.length,
          };

          pattern = {
            avgTime: minutesToTime(avgMinutes),
            earliestTime: minutesToTime(Math.min(...allTimes)),
            latestTime: minutesToTime(Math.max(...allTimes)),
            stdDevMinutes: Math.round(calculateStdDev(allTimes)),
          };
        }
      }

      recommendations.push({
        targetId: target.id,
        busNo: target.bus_no,
        stationName: target.station_name,
        recommendation,
        pattern,
      });
    }

    return successResponse({
      recommendations,
      today: {
        dayOfWeek,
        dayName: dayNames[dayOfWeek],
        date: today.toISOString().split('T')[0],
      },
      settings: {
        bufferMinutes,
        analysisDays: days,
      },
    });
  } catch (error) {
    console.error('[Recommend API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return ApiErrors.internalError('추천 데이터 조회에 실패했습니다.', errorMessage);
  }
}

/**
 * 요일별 패턴 분석
 * @param logs 도착 기록
 * @param timeWindowStart 시간대 필터 시작 (분 단위, null이면 필터 없음)
 * @param timeWindowEnd 시간대 필터 종료 (분 단위, null이면 필터 없음)
 */
function analyzeDayPatterns(
  logs: ArrivalLog[],
  timeWindowStart: number | null,
  timeWindowEnd: number | null
): Record<number, DayPattern> {
  const patterns: Record<number, DayPattern> = {};

  // 요일별로 그룹화
  const byDay: Record<number, number[]> = {};

  for (const log of logs) {
    const date = new Date(log.arrival_time);
    const day = log.day_of_week;
    const minutes = date.getHours() * 60 + date.getMinutes();

    // 시간대 필터 적용
    if (timeWindowStart !== null && timeWindowEnd !== null) {
      if (minutes < timeWindowStart || minutes > timeWindowEnd) {
        continue; // 시간대 범위 밖이면 건너뜀
      }
    }

    if (!byDay[day]) {
      byDay[day] = [];
    }
    byDay[day].push(minutes);
  }

  // 각 요일의 패턴 계산
  for (const [day, times] of Object.entries(byDay)) {
    const dayNum = parseInt(day);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const stdDev = calculateStdDev(times);

    patterns[dayNum] = {
      count: times.length,
      avgMinutes: Math.round(avg),
      stdDev,
      times,
    };
  }

  return patterns;
}

/**
 * 표준편차 계산
 */
function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;

  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;

  return Math.sqrt(avgSquareDiff);
}

/**
 * 분을 HH:MM 형식으로 변환
 */
function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}
