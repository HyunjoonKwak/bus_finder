/**
 * 통계 관련 공유 타입 정의
 */

export interface DayStats {
  day: number;
  dayName: string;
  count: number;
  avgInterval: number | null;  // 평균 배차간격 (분)
  firstTime: string | null;    // 첫 도착 시간
  lastTime: string | null;     // 마지막 도착 시간
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
  avgInterval: number | null;    // 평균 배차간격 (분)
  dailyAvgCount: number | null;  // 일평균 도착 횟수
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

// 페어 정류장 관련 타입
export interface StationPair {
  id: string;
  userId: string;
  busId: string;
  busNo: string;
  stationA: {
    id: string;
    name: string;
    arsId?: string | null;
  };
  stationB: {
    id: string;
    name: string;
    arsId?: string | null;
  };
  name?: string | null;
  createdAt: string;
}

export interface MatchedArrival {
  plateNo: string;
  arrivalAtA: string;
  arrivalAtB: string;
  travelTimeMinutes: number;
}

export interface PairAnalysis {
  pairId: string;
  busNo: string;
  stationA: string;
  stationB: string;
  period: string;

  // 소요시간 통계
  avgTravelTime: number | null;      // 평균 소요시간 (분)
  minTravelTime: number | null;      // 최소 소요시간
  maxTravelTime: number | null;      // 최대 소요시간
  stdDevTravelTime: number | null;   // 표준편차

  // 매칭/누락 통계
  totalArrivalsAtA: number;          // A 정류장 총 도착 수
  totalArrivalsAtB: number;          // B 정류장 총 도착 수
  matchedCount: number;              // plate_no로 매칭된 수
  missingAtB: number;                // A에서 출발 후 B 도착 없음
  matchRate: number;                 // 매칭률 (%)

  // 최근 매칭 기록
  recentMatches: MatchedArrival[];
}
