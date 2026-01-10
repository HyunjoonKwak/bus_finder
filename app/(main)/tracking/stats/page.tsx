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
  avgInterval: number | null;
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
  const [editMode, setEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const handleDeleteLog = async (logId: string) => {
    if (!confirm('이 도착 기록을 삭제하시겠습니까?')) return;

    setDeletingId(logId);
    try {
      const response = await fetch(`/api/tracking/logs?id=${logId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // 통계 다시 불러오기
        await fetchStats();
      } else {
        const data = await response.json();
        alert(`삭제 실패: ${data.error}`);
      }
    } catch (error) {
      console.error('Delete log error:', error);
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!busId || !stationId) {
    return (
      <div className="px-4 py-4">
        <p className="text-muted-foreground">잘못된 접근입니다.</p>
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
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <button
        onClick={() => router.back()}
        className="flex items-center text-muted-foreground mb-4"
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
        <h1 className="text-xl font-bold text-foreground">{busNo} 도착 통계</h1>
        <p className="text-sm text-muted-foreground">{stationName}</p>
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
            className="w-16 h-16 text-muted-foreground/50 mb-4"
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
          <p className="text-muted-foreground">
            아직 수집된 도착 기록이 없습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 요약 */}
          <Card className="p-4">
            <h2 className="font-semibold text-foreground mb-3">요약</h2>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">
                  {stats.totalCount}
                </p>
                <p className="text-xs text-muted-foreground">총 기록</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.avgInterval ? `${stats.avgInterval}분` : '-'}
                </p>
                <p className="text-xs text-muted-foreground">평균 배차간격</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {stats.firstArrival || '-'}
                </p>
                <p className="text-xs text-muted-foreground">가장 이른 도착</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                  {stats.lastArrival || '-'}
                </p>
                <p className="text-xs text-muted-foreground">가장 늦은 도착</p>
              </div>
            </div>
          </Card>

          {/* 요일별 통계 */}
          <Card className="p-4">
            <h2 className="font-semibold text-foreground mb-3">요일별 평균 도착 시간</h2>
            <div className="space-y-2">
              {stats.byDay.map((day) => (
                <div
                  key={day.day}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <span className="font-medium text-foreground w-8">
                    {day.dayName}
                  </span>
                  <div className="flex-1 mx-4">
                    <div
                      className="bg-primary/20 rounded-full h-2"
                      style={{
                        width: `${Math.max((day.count / Math.max(...stats.byDay.map((d) => d.count))) * 100, 5)}%`,
                      }}
                    />
                  </div>
                  <div className="text-right">
                    {day.avgTime ? (
                      <span className="font-semibold text-primary">
                        {day.avgTime}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({day.count}회)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* 시간대별 분포 */}
          <Card className="p-4">
            <h2 className="font-semibold text-foreground mb-3">시간대별 도착 분포</h2>
            <div className="flex items-end h-32 gap-1">
              {stats.byHour.map((hour) => {
                const maxCount = Math.max(...stats.byHour.map((h) => h.count));
                const height = maxCount > 0 ? (hour.count / maxCount) * 100 : 0;
                return (
                  <div key={hour.hour} className="flex-1 flex flex-col items-center">
                    <div
                      className={`w-full rounded-t ${hour.count > 0 ? 'bg-primary' : 'bg-muted'}`}
                      style={{ height: `${Math.max(height, 2)}%` }}
                    />
                    {hour.hour % 3 === 0 && (
                      <span className="text-xs text-muted-foreground mt-1">
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
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground">최근 도착 기록</h2>
              <button
                onClick={() => setEditMode(!editMode)}
                className={`text-sm px-2 py-1 rounded transition-colors ${
                  editMode
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {editMode ? '완료' : '편집'}
              </button>
            </div>
            <div className="space-y-2">
              {stats.recentLogs.map((log) => {
                const date = new Date(log.arrival_time);
                const isDeleting = deletingId === log.id;
                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between py-2 border-b border-border last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      {editMode && (
                        <button
                          onClick={() => handleDeleteLog(log.id)}
                          disabled={isDeleting}
                          className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                          title="삭제"
                        >
                          {isDeleting ? (
                            <div className="w-4 h-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {date.toLocaleDateString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          weekday: 'short',
                        })}
                      </span>
                    </div>
                    <span className="font-semibold text-primary">
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
            {stats.recentLogs.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                기록이 없습니다.
              </p>
            )}
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
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      }
    >
      <StatsContent />
    </Suspense>
  );
}
