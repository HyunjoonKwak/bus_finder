'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Stats, Pagination, ArrivalLog } from '@/types/stats';

function StatsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentLogs, setCurrentLogs] = useState<ArrivalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [editMode, setEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const logsPerPage = 20;

  const busId = searchParams.get('bus_id');
  const stationId = searchParams.get('station_id');
  const busNo = searchParams.get('bus_no') || '';
  const stationName = searchParams.get('station_name') || '';

  const fetchStats = useCallback(async (page: number = 1, isInitial: boolean = false) => {
    try {
      setError(null);
      if (isInitial) {
        setLoading(true);
      } else {
        setLogsLoading(true);
      }

      const response = await fetch(
        `/api/tracking/stats?bus_id=${busId}&station_id=${stationId}&days=${days}&page=${page}&limit=${logsPerPage}`
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '통계 데이터를 불러오는데 실패했습니다.');
      }

      const data = await response.json();

      // 첫 페이지에서만 통계 데이터 저장 (API가 첫 페이지에서만 통계 계산)
      if (isInitial || page === 1) {
        setStats(data.stats);
      }

      setPagination(data.pagination);
      setCurrentLogs(data.stats.recentLogs);
      setCurrentPage(page);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
      setLogsLoading(false);
    }
  }, [busId, stationId, days, logsPerPage]);

  useEffect(() => {
    if (busId && stationId) {
      setCurrentPage(1);
      fetchStats(1, true);
    }
  }, [busId, stationId, days, fetchStats]);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= (pagination?.totalPages || 1) && !logsLoading) {
      fetchStats(page, false);
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
        await fetchStats(currentPage, false);
      } else {
        const data = await response.json();
        alert(`삭제 실패: ${data.error}`);
      }
    } catch {
      alert('삭제 중 오류가 발생했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  // CSV 내보내기
  const handleExportCSV = async () => {
    if (!stats) return;

    try {
      // 전체 로그 데이터 가져오기
      const response = await fetch(
        `/api/tracking/stats?bus_id=${busId}&station_id=${stationId}&days=${days}&page=1&limit=10000`
      );
      const data = await response.json();
      const allLogs = data.stats.recentLogs;

      // CSV 헤더
      const headers = ['날짜', '시간', '요일', '차량번호'];
      const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

      // CSV 데이터 생성
      const csvRows = [headers.join(',')];
      allLogs.forEach((log: ArrivalLog) => {
        const date = new Date(log.arrival_time);
        const dateStr = date.toLocaleDateString('ko-KR');
        const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
        const dayName = dayNames[log.day_of_week];
        const plateNo = log.plate_no || '';
        csvRows.push([dateStr, timeStr, dayName, plateNo].join(','));
      });

      // 다운로드
      const csvContent = '\uFEFF' + csvRows.join('\n'); // BOM for Excel
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${busNo}_${stationName}_도착기록_${days}일.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('CSV 내보내기에 실패했습니다.');
    }
  };

  // 페이지네이션에 표시할 페이지 번호 계산
  const getPageNumbers = () => {
    if (!pagination) return [];
    const { totalPages } = pagination;
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
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

  // 에러 UI
  if (error) {
    return (
      <div className="px-4 py-4">
        <button
          onClick={() => router.back()}
          className="flex items-center text-muted-foreground mb-4"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          돌아가기
        </button>

        <Card className="p-6 bg-destructive/10 border-destructive/30">
          <div className="flex flex-col items-center text-center">
            <svg className="w-12 h-12 text-destructive mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-lg font-semibold text-destructive mb-2">데이터를 불러올 수 없습니다</h2>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => fetchStats(1, true)} variant="outline">다시 시도</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <button
        onClick={() => router.back()}
        className="flex items-center text-muted-foreground mb-4"
        aria-label="뒤로가기"
      >
        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        돌아가기
      </button>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">{busNo} 도착 통계</h1>
          <p className="text-sm text-muted-foreground">{stationName}</p>
        </div>
        {stats && stats.totalCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            CSV 내보내기
          </Button>
        )}
      </div>

      {/* 기간 선택 */}
      <div className="flex gap-2 mb-4">
        {[7, 14, 30, 90].map((d) => (
          <Button key={d} variant={days === d ? 'default' : 'outline'} size="sm" onClick={() => setDays(d)}>
            {d}일
          </Button>
        ))}
      </div>

      {!stats || stats.totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-16 h-16 text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-muted-foreground">아직 수집된 도착 기록이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 요약 */}
          <Card className="p-4">
            <h2 className="font-semibold text-foreground mb-3">요약</h2>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{stats.totalCount}</p>
                <p className="text-xs text-muted-foreground">총 기록</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.avgInterval ? `${stats.avgInterval}분` : '-'}
                </p>
                <p className="text-xs text-muted-foreground">평균 배차간격</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.firstArrival || '-'}</p>
                <p className="text-xs text-muted-foreground">가장 이른 도착</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{stats.lastArrival || '-'}</p>
                <p className="text-xs text-muted-foreground">가장 늦은 도착</p>
              </div>
            </div>

            {/* 표준편차 */}
            {stats.stdDeviation !== null && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">도착 시간 편차</span>
                  <span className="font-semibold text-foreground">±{stats.stdDeviation}분</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.stdDeviation <= 10 ? '매우 일정한 패턴' : stats.stdDeviation <= 20 ? '비교적 일정한 패턴' : '불규칙한 패턴'}
                </p>
              </div>
            )}
          </Card>

          {/* 주중/주말 비교 */}
          {(stats.weekdayStats || stats.weekendStats) && (
            <Card className="p-4">
              <h2 className="font-semibold text-foreground mb-3">주중 vs 주말</h2>
              <div className="grid grid-cols-2 gap-4">
                {/* 주중 */}
                <div className="bg-blue-500/10 rounded-lg p-3">
                  <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">주중 (월~금)</p>
                  {stats.weekdayStats ? (
                    <>
                      <p className="text-lg font-bold text-foreground">{stats.weekdayStats.avgTime}</p>
                      <p className="text-xs text-muted-foreground">평균 도착</p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        <p>{stats.weekdayStats.firstArrival} ~ {stats.weekdayStats.lastArrival}</p>
                        <p>{stats.weekdayStats.count}회 기록</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">기록 없음</p>
                  )}
                </div>
                {/* 주말 */}
                <div className="bg-orange-500/10 rounded-lg p-3">
                  <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-2">주말 (토~일)</p>
                  {stats.weekendStats ? (
                    <>
                      <p className="text-lg font-bold text-foreground">{stats.weekendStats.avgTime}</p>
                      <p className="text-xs text-muted-foreground">평균 도착</p>
                      <div className="mt-2 text-xs text-muted-foreground">
                        <p>{stats.weekendStats.firstArrival} ~ {stats.weekendStats.lastArrival}</p>
                        <p>{stats.weekendStats.count}회 기록</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">기록 없음</p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* 요일별 통계 */}
          {stats.byDay.length > 0 && (
            <Card className="p-4">
              <h2 className="font-semibold text-foreground mb-3">요일별 평균 도착 시간</h2>
              <div className="space-y-2">
                {stats.byDay.map((day) => {
                  const maxCount = Math.max(...stats.byDay.map((d) => d.count));
                  const barWidth = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
                  // 시간을 분으로 변환해서 위치 계산 (5:00~24:00 범위)
                  const avgMinutes = day.avgTime ? parseInt(day.avgTime.split(':')[0]) * 60 + parseInt(day.avgTime.split(':')[1]) : null;
                  const timePosition = avgMinutes !== null ? ((avgMinutes - 300) / (1440 - 300)) * 100 : null; // 5:00=300분, 24:00=1440분

                  return (
                    <div key={day.day} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <span className="font-medium text-foreground w-8">{day.dayName}</span>
                      <div className="flex-1 mx-4 relative">
                        {/* 배경 바 (기록 수 기준) */}
                        <div
                          className="bg-primary/20 rounded-full h-2"
                          style={{ width: `${Math.max(barWidth, 5)}%` }}
                        />
                        {/* 시간 위치 표시 점 */}
                        {timePosition !== null && day.count > 0 && (
                          <div
                            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full border-2 border-background shadow-sm"
                            style={{ left: `${Math.max(5, Math.min(95, timePosition))}%` }}
                            title={`평균 ${day.avgTime}`}
                          />
                        )}
                      </div>
                      <div className="text-right min-w-[80px]">
                        {day.avgTime ? (
                          <span className="font-semibold text-primary">{day.avgTime}</span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                        <span className="text-xs text-muted-foreground ml-2">({day.count}회)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">● 점은 평균 도착 시간 위치</p>
            </Card>
          )}

          {/* 시간대별 분포 */}
          {stats.byHour.length > 0 && (
            <Card className="p-4">
              <h2 className="font-semibold text-foreground mb-3">시간대별 도착 분포</h2>
              <div className="flex items-end h-32 gap-1 relative">
                {stats.byHour.map((hour) => {
                  const maxCount = Math.max(...stats.byHour.map((h) => h.count));
                  const height = maxCount > 0 ? (hour.count / maxCount) * 100 : 0;
                  const isHovered = hoveredHour === hour.hour;

                  return (
                    <div
                      key={hour.hour}
                      className="flex-1 flex flex-col items-center relative"
                      onMouseEnter={() => setHoveredHour(hour.hour)}
                      onMouseLeave={() => setHoveredHour(null)}
                      onTouchStart={() => setHoveredHour(hour.hour)}
                      onTouchEnd={() => setHoveredHour(null)}
                    >
                      {/* 툴팁 */}
                      {isHovered && hour.count > 0 && (
                        <div className="absolute bottom-full mb-2 px-2 py-1 bg-foreground text-background text-xs rounded shadow-lg whitespace-nowrap z-10">
                          {hour.hour}시: {hour.count}회
                        </div>
                      )}
                      <div
                        className={`w-full rounded-t transition-all duration-150 ${
                          hour.count > 0
                            ? isHovered
                              ? 'bg-primary/80'
                              : 'bg-primary'
                            : 'bg-muted'
                        }`}
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                      {hour.hour % 3 === 0 && (
                        <span className="text-xs text-muted-foreground mt-1">{hour.hour}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* 최근 기록 */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-semibold text-foreground">도착 기록</h2>
                {pagination && (
                  <p className="text-xs text-muted-foreground">
                    {pagination.totalLogs}건 중 {(currentPage - 1) * logsPerPage + 1}-{Math.min(currentPage * logsPerPage, pagination.totalLogs)}
                  </p>
                )}
              </div>
              <button
                onClick={() => setEditMode(!editMode)}
                className={`text-sm px-2 py-1 rounded transition-colors ${
                  editMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {editMode ? '완료' : '편집'}
              </button>
            </div>
            <div className="space-y-2">
              {currentLogs.map((log) => {
                const date = new Date(log.arrival_time);
                const isDeleting = deletingId === log.id;
                return (
                  <div key={log.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
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
                        {date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', weekday: 'short' })}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold text-primary">
                        {date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}
                      </span>
                      {log.plate_no && (
                        <span className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{log.plate_no}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {currentLogs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">기록이 없습니다.</p>}

            {/* 페이지네이션 */}
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1 || logsLoading}
                    className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  {getPageNumbers().map((pageNum, idx) =>
                    typeof pageNum === 'number' ? (
                      <button
                        key={idx}
                        onClick={() => goToPage(pageNum)}
                        disabled={logsLoading}
                        className={`w-8 h-8 text-sm rounded ${
                          pageNum === currentPage ? 'bg-primary text-primary-foreground' : 'border border-border hover:bg-muted'
                        } disabled:opacity-50`}
                      >
                        {pageNum}
                      </button>
                    ) : (
                      <span key={idx} className="px-1 text-muted-foreground">...</span>
                    )
                  )}
                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === pagination.totalPages || logsLoading}
                    className="px-3 py-1.5 text-sm rounded border border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
                {logsLoading && (
                  <div className="flex justify-center mt-2">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
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
