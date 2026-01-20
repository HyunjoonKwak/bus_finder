/**
 * 통계 관련 공유 타입 정의
 */

export interface DayStats {
  day: number;
  dayName: string;
  count: number;
  times: string[];
  avgTime: string | null;
}

export interface HourStats {
  hour: number;
  count: number;
}

export interface ArrivalLog {
  id: string;
  bus_id: string;
  bus_no: string;
  station_id: string;
  station_name: string;
  arrival_time: string;
  day_of_week: number;
  plate_no?: string | null;
}

export interface WeekdayWeekendStats {
  count: number;
  avgTime: string | null;
  firstArrival: string | null;
  lastArrival: string | null;
}

export interface Stats {
  totalCount: number;
  firstArrival: string | null;
  lastArrival: string | null;
  avgInterval: number | null;
  stdDeviation: number | null; // 도착 시간 표준편차 (분)
  weekdayStats: WeekdayWeekendStats | null; // 주중 통계
  weekendStats: WeekdayWeekendStats | null; // 주말 통계
  byDay: DayStats[];
  byHour: HourStats[];
  recentLogs: ArrivalLog[];
  period: string;
}

export interface Pagination {
  page: number;
  limit: number;
  totalLogs: number;
  totalPages: number;
  hasMore: boolean;
}

export interface StatsApiResponse {
  stats: Stats;
  pagination: Pagination;
}
