'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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

interface ArrivalLog {
  id: string;
  arrival_time: string;
  day_of_week: number;
}

interface Stats {
  totalCount: number;
  firstArrival: string | null;
  lastArrival: string | null;
  byDay: DayStats[];
  byHour: HourStats[];
  recentLogs: ArrivalLog[];
  period: string;
}

function StatsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const busId = searchParams.get('bus_id');
  const stationId = searchParams.get('station_id');
  const busNo = searchParams.get('bus_no') || '';
  const stationName = searchParams.get('station_name') || '';

  useEffect(() => {
    if (busId && stationId) {
      fetchStats();
    }
  }, [busId, stationId, days]);

  const fetchStats = async () => {
    try {
      const response = await fetch(
        `/api/tracking/stats?bus_id=${busId}&station_id=${stationId}&days=${days}`
      );
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Fetch stats error:', error);
    } finally {
      setLoading(false);
    }
  };

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  if (!busId || !stationId) {
    return (
      <div className="px-4 py-4">
        <p className="text-slate-500">잘못된 접근입니다.</p>
        <Button className="mt-4" onClick={() => router.push('/tracking')}>
          돌아가기
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-4">
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <button
        onClick={() => router.back()}
        className="flex items-center text-slate-600 mb-4"
      >
        <svg
          className="w-5 h-5 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        돌아가기
      </button>

      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">{busNo} 도착 통계</h1>
        <p className="text-sm text-slate-500">{stationName}</p>
      </div>

      {/* 기간 선택 */}
      <div className="flex gap-2 mb-4">
        {[7, 14, 30, 90].map((d) => (
          <Button
            key={d}
            variant={days === d ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(d)}
          >
            {d}일
          </Button>
        ))}
      </div>

      {!stats || stats.totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg
            className="w-16 h-16 text-slate-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-slate-500">
            아직 수집된 도착 기록이 없습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 요약 */}
          <Card className="p-4">
            <h2 className="font-semibold text-slate-900 mb-3">요약</h2>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-emerald-600">
                  {stats.totalCount}
                </p>
                <p className="text-xs text-slate-500">총 기록</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.firstArrival || '-'}
                </p>
                <p className="text-xs text-slate-500">가장 이른 도착</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600">
                  {stats.lastArrival || '-'}
                </p>
                <p className="text-xs text-slate-500">가장 늦은 도착</p>
              </div>
            </div>
          </Card>

          {/* 요일별 통계 */}
          <Card className="p-4">
            <h2 className="font-semibold text-slate-900 mb-3">요일별 평균 도착 시간</h2>
            <div className="space-y-2">
              {stats.byDay.map((day) => (
                <div
                  key={day.day}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <span className="font-medium text-slate-700 w-8">
                    {day.dayName}
                  </span>
                  <div className="flex-1 mx-4">
                    <div
                      className="bg-emerald-100 rounded-full h-2"
                      style={{
                        width: `${Math.max((day.count / Math.max(...stats.byDay.map((d) => d.count))) * 100, 5)}%`,
                      }}
                    />
                  </div>
                  <div className="text-right">
                    {day.avgTime ? (
                      <span className="font-semibold text-emerald-600">
                        {day.avgTime}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                    <span className="text-xs text-slate-400 ml-2">
                      ({day.count}회)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 시간대별 분포 */}
          <Card className="p-4">
            <h2 className="font-semibold text-slate-900 mb-3">시간대별 도착 분포</h2>
            <div className="flex items-end h-32 gap-1">
              {stats.byHour.map((hour) => {
                const maxCount = Math.max(...stats.byHour.map((h) => h.count));
                const height = maxCount > 0 ? (hour.count / maxCount) * 100 : 0;
                return (
                  <div key={hour.hour} className="flex-1 flex flex-col items-center">
                    <div
                      className={`w-full rounded-t ${hour.count > 0 ? 'bg-emerald-400' : 'bg-slate-100'}`}
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                    {hour.hour % 3 === 0 && (
                      <span className="text-xs text-slate-400 mt-1">
                        {hour.hour}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* 최근 기록 */}
          <Card className="p-4">
            <h2 className="font-semibold text-slate-900 mb-3">최근 도착 기록</h2>
            <div className="space-y-2">
              {stats.recentLogs.map((log) => {
                const date = new Date(log.arrival_time);
                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                  >
                    <span className="text-sm text-slate-600">
                      {date.toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </span>
                    <span className="font-semibold text-emerald-600">
                      {date.toLocaleTimeString('ko-KR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function TrackingStatsPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-4">
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      }
    >
      <StatsContent />
    </Suspense>
  );
}
