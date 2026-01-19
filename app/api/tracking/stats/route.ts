import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';

interface ArrivalLog {
  id: string;
  bus_id: string;
  bus_no: string;
  station_id: string;
  station_name: string;
  arrival_time: string;
  day_of_week: number;
  plate_no?: string | null;
}

interface DayStats {
  day: number;
  dayName: string;
  count: number;
  times: string[];
  avgTime: string | null;
}

interface HourStats {
  hour: number;
  count: number;
}

// UTC를 KST(UTC+9)로 변환
function toKST(date: Date): Date {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
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

  const { data: logs, error } = await supabase
    .from('bus_arrival_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('bus_id', bus_id)
    .eq('station_id', station_id)
    .gte(
      'arrival_time',
      new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    )
    .order('arrival_time', { ascending: true });

  if (error) {
    return ApiErrors.internalError('통계 조회에 실패했습니다.', error.message);
  }

  const typedLogs = logs as ArrivalLog[];

  // 요일별 통계
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const byDay: DayStats[] = dayNames.map((name, i) => ({
    day: i,
    dayName: name,
    count: 0,
    times: [] as string[],
    avgTime: null,
  }));

  // 시간대별 통계
  const byHour: HourStats[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: 0,
  }));

  typedLogs.forEach((log) => {
    const date = new Date(log.arrival_time);
    const kstDate = toKST(date);
    const dayOfWeek = log.day_of_week;
    const hour = kstDate.getUTCHours(); // KST로 변환된 시간의 시간대
    const timeStr = `${kstDate.getUTCHours().toString().padStart(2, '0')}:${kstDate.getUTCMinutes().toString().padStart(2, '0')}`;

    byDay[dayOfWeek].count++;
    byDay[dayOfWeek].times.push(timeStr);
    byHour[hour].count++;
  });

  // 요일별 평균 시간 계산
  byDay.forEach((day) => {
    if (day.times.length > 0) {
      const totalMinutes = day.times.reduce((sum, time) => {
        const [h, m] = time.split(':').map(Number);
        return sum + h * 60 + m;
      }, 0);
      const avgMinutes = Math.round(totalMinutes / day.times.length);
      const avgH = Math.floor(avgMinutes / 60);
      const avgM = avgMinutes % 60;
      day.avgTime = `${avgH.toString().padStart(2, '0')}:${avgM.toString().padStart(2, '0')}`;
    }
  });

  // 전체 통계
  const totalCount = typedLogs.length;
  let firstArrival: string | null = null;
  let lastArrival: string | null = null;
  let avgInterval: number | null = null;

  if (typedLogs.length > 0) {
    const times = typedLogs.map((log) => {
      const d = toKST(new Date(log.arrival_time));
      return d.getUTCHours() * 60 + d.getUTCMinutes();
    });
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    const minH = Math.floor(minTime / 60);
    const minM = minTime % 60;
    const maxH = Math.floor(maxTime / 60);
    const maxM = maxTime % 60;

    firstArrival = `${minH.toString().padStart(2, '0')}:${minM.toString().padStart(2, '0')}`;
    lastArrival = `${maxH.toString().padStart(2, '0')}:${maxM.toString().padStart(2, '0')}`;

    // 평균 배차간격 계산 (같은 날 기록들 사이의 간격)
    if (typedLogs.length >= 2) {
      const logsByDate = new Map<string, Date[]>();
      typedLogs.forEach((log) => {
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

  // 최근 도착 기록 (페이지네이션 지원)
  const sortedLogs = [...typedLogs].reverse(); // 최신순 정렬
  const totalLogs = sortedLogs.length;
  const totalPages = Math.ceil(totalLogs / limit);
  const startIndex = (page - 1) * limit;
  const recentLogs = sortedLogs.slice(startIndex, startIndex + limit);

  return successResponse({
    stats: {
      totalCount,
      firstArrival,
      lastArrival,
      avgInterval,
      byDay,
      byHour,
      recentLogs,
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
