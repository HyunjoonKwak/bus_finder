import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';
import type { DayStats, HourStats, WeekdayWeekendStats } from '@/types/stats';

// UTC를 KST(UTC+9)로 변환
function toKST(date: Date): Date {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
}

// 분 단위 시간을 "HH:MM" 형식으로 변환
function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

// 표준편차 계산
function calculateStdDeviation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(Math.sqrt(variance));
}

// 주중/주말 통계 계산 헬퍼
function calculateWeekdayWeekendStats(times: number[]): WeekdayWeekendStats | null {
  if (times.length === 0) return null;

  const avgMinutes = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  return {
    count: times.length,
    avgTime: minutesToTimeStr(avgMinutes),
    firstArrival: minutesToTimeStr(minTime),
    lastArrival: minutesToTimeStr(maxTime),
  };
}

// GET: 버스 도착 통계 조회
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  const { searchParams } = new URL(request.url);
  const bus_id = searchParams.get('bus_id');
  const station_id = searchParams.get('station_id');
  const days = parseInt(searchParams.get('days') || '30', 10);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);

  if (!bus_id || !station_id) {
    return ApiErrors.badRequest('버스 ID와 정류소 ID가 필요합니다.');
  }

  const dateThreshold = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // 1. 총 개수 조회 (페이지네이션용)
  const { count: totalCount, error: countError } = await supabase
    .from('bus_arrival_logs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('bus_id', bus_id)
    .eq('station_id', station_id)
    .gte('arrival_time', dateThreshold);

  if (countError) {
    return ApiErrors.internalError('통계 조회에 실패했습니다.', countError.message);
  }

  const totalLogs = totalCount || 0;
  const totalPages = Math.ceil(totalLogs / limit);

  // 2. 통계 계산용 전체 데이터 조회 (첫 페이지에서만)
  let byDay: DayStats[] = [];
  let byHour: HourStats[] = [];
  let firstArrival: string | null = null;
  let lastArrival: string | null = null;
  let avgInterval: number | null = null;
  let stdDeviation: number | null = null;
  let weekdayStats: WeekdayWeekendStats | null = null;
  let weekendStats: WeekdayWeekendStats | null = null;

  if (page === 1 && totalLogs > 0) {
    const { data: allLogs, error: allLogsError } = await supabase
      .from('bus_arrival_logs')
      .select('arrival_time, day_of_week')
      .eq('user_id', user.id)
      .eq('bus_id', bus_id)
      .eq('station_id', station_id)
      .gte('arrival_time', dateThreshold)
      .order('arrival_time', { ascending: true });

    if (allLogsError) {
      return ApiErrors.internalError('통계 조회에 실패했습니다.', allLogsError.message);
    }

    // 요일별 통계 초기화
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    byDay = dayNames.map((name, i) => ({
      day: i,
      dayName: name,
      count: 0,
      times: [] as string[],
      avgTime: null,
    }));

    // 시간대별 통계 초기화
    byHour = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      count: 0,
    }));

    const times: number[] = [];
    const weekdayTimes: number[] = []; // 월~금 (1~5)
    const weekendTimes: number[] = []; // 토,일 (0, 6)

    allLogs.forEach((log) => {
      const date = new Date(log.arrival_time);
      const kstDate = toKST(date);
      const dayOfWeek = log.day_of_week;
      const hour = kstDate.getUTCHours();
      const timeStr = `${kstDate.getUTCHours().toString().padStart(2, '0')}:${kstDate.getUTCMinutes().toString().padStart(2, '0')}`;
      const timeMinutes = kstDate.getUTCHours() * 60 + kstDate.getUTCMinutes();

      byDay[dayOfWeek].count++;
      byDay[dayOfWeek].times.push(timeStr);
      byHour[hour].count++;
      times.push(timeMinutes);

      // 주중/주말 분류
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        weekdayTimes.push(timeMinutes);
      } else {
        weekendTimes.push(timeMinutes);
      }
    });

    // 요일별 평균 시간 계산
    byDay.forEach((day) => {
      if (day.times.length > 0) {
        const totalMinutes = day.times.reduce((sum, time) => {
          const [h, m] = time.split(':').map(Number);
          return sum + h * 60 + m;
        }, 0);
        const avgMinutes = Math.round(totalMinutes / day.times.length);
        day.avgTime = minutesToTimeStr(avgMinutes);
      }
    });

    // 가장 이른/늦은 도착 시간
    if (times.length > 0) {
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);
      firstArrival = minutesToTimeStr(minTime);
      lastArrival = minutesToTimeStr(maxTime);

      // 표준편차 계산
      stdDeviation = calculateStdDeviation(times);
    }

    // 주중/주말 통계 계산
    weekdayStats = calculateWeekdayWeekendStats(weekdayTimes);
    weekendStats = calculateWeekdayWeekendStats(weekendTimes);

    // 평균 배차간격 계산 (같은 날 기록들 사이의 간격)
    if (allLogs.length >= 2) {
      const logsByDate = new Map<string, Date[]>();
      allLogs.forEach((log) => {
        const date = new Date(log.arrival_time);
        const dateKey = date.toISOString().split('T')[0];
        const existing = logsByDate.get(dateKey) || [];
        existing.push(date);
        logsByDate.set(dateKey, existing);
      });

      const intervals: number[] = [];
      logsByDate.forEach((dates) => {
        if (dates.length >= 2) {
          dates.sort((a, b) => a.getTime() - b.getTime());
          for (let i = 1; i < dates.length; i++) {
            const diffMinutes = (dates[i].getTime() - dates[i - 1].getTime()) / (1000 * 60);
            if (diffMinutes >= 5 && diffMinutes <= 120) {
              intervals.push(diffMinutes);
            }
          }
        }
      });

      if (intervals.length > 0) {
        avgInterval = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
      }
    }
  }

  // 3. 페이지네이션된 로그 목록 조회 (서버사이드)
  const offset = (page - 1) * limit;
  const { data: paginatedLogs, error: logsError } = await supabase
    .from('bus_arrival_logs')
    .select('id, arrival_time, day_of_week, plate_no')
    .eq('user_id', user.id)
    .eq('bus_id', bus_id)
    .eq('station_id', station_id)
    .gte('arrival_time', dateThreshold)
    .order('arrival_time', { ascending: false })
    .range(offset, offset + limit - 1);

  if (logsError) {
    return ApiErrors.internalError('로그 조회에 실패했습니다.', logsError.message);
  }

  return successResponse({
    stats: {
      totalCount: totalLogs,
      firstArrival,
      lastArrival,
      avgInterval,
      stdDeviation,
      weekdayStats,
      weekendStats,
      byDay,
      byHour,
      recentLogs: paginatedLogs || [],
      period: `최근 ${days}일`,
    },
    pagination: {
      page,
      limit,
      totalLogs,
      totalPages,
      hasMore: page < totalPages,
    },
  });
}
