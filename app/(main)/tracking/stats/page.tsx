'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Stats, Pagination, ArrivalLog, StationPair } from '@/types/stats';
import {
  SummaryCard,
  WeekdayWeekendCard,
  DayStatsChart,
  HourStatsChart,
  ArrivalLogsList,
  PairAnalysisCard,
} from '@/components/tracking/stats';
import { PairSetupModal } from '@/components/tracking/PairSetupModal';

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
  const logsPerPage = 20;

  // 페어 관련 상태
  const [pairs, setPairs] = useState<StationPair[]>([]);
  const [pairsLoading, setPairsLoading] = useState(false);
  const [pairModalOpen, setPairModalOpen] = useState(false);

  const busId = searchParams.get('bus_id');
  const stationId = searchParams.get('station_id');
  const busNo = searchParams.get('bus_no') || '';
  const stationName = searchParams.get('station_name') || '';

  const fetchStats = useCallback(
    async (page: number = 1, isInitial: boolean = false) => {
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
        const errorMessage =
          err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
        setError(errorMessage);
      } finally {
        setLoading(false);
        setLogsLoading(false);
      }
    },
    [busId, stationId, days, logsPerPage]
  );

  // 페어 목록 조회
  const fetchPairs = useCallback(async () => {
    if (!busId) return;

    try {
      setPairsLoading(true);
      const response = await fetch(`/api/tracking/pairs?busId=${busId}`);

      if (response.ok) {
        const data = await response.json();
        // 현재 정류장이 포함된 페어만 필터링
        const relevantPairs = (data.pairs || []).filter(
          (p: StationPair) => p.stationA.id === stationId || p.stationB.id === stationId
        );
        setPairs(relevantPairs);
      }
    } catch {
      // 페어 로드 실패는 무시
    } finally {
      setPairsLoading(false);
    }
  }, [busId, stationId]);

  useEffect(() => {
    if (busId && stationId) {
      setCurrentPage(1);
      fetchStats(1, true);
      fetchPairs();
    }
  }, [busId, stationId, days, fetchStats, fetchPairs]);

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

  // 페어 삭제 핸들러
  const handlePairDelete = (pairId: string) => {
    setPairs((prev) => prev.filter((p) => p.id !== pairId));
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
        const timeStr = date.toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
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

  // 스켈레톤 UI 로딩
  if (loading) {
    return (
      <div className="px-4 py-4" role="status" aria-label="통계 데이터 로딩 중">
        {/* 헤더 스켈레톤 */}
        <div className="flex items-center mb-4">
          <div className="w-20 h-5 bg-muted animate-pulse rounded" />
        </div>
        <div className="mb-4">
          <div className="w-32 h-6 bg-muted animate-pulse rounded mb-1" />
          <div className="w-24 h-4 bg-muted animate-pulse rounded" />
        </div>

        {/* 기간 선택 스켈레톤 */}
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-12 h-8 bg-muted animate-pulse rounded" />
          ))}
        </div>

        {/* 요약 카드 스켈레톤 */}
        <Card className="p-4 mb-4">
          <div className="w-16 h-5 bg-muted animate-pulse rounded mb-3" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="text-center">
                <div className="w-16 h-8 bg-muted animate-pulse rounded mx-auto mb-1" />
                <div className="w-12 h-3 bg-muted animate-pulse rounded mx-auto" />
              </div>
            ))}
          </div>
        </Card>

        {/* 차트 스켈레톤 */}
        <Card className="p-4 mb-4">
          <div className="w-32 h-5 bg-muted animate-pulse rounded mb-3" />
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-4 bg-muted animate-pulse rounded" />
                <div
                  className="flex-1 h-2 bg-muted animate-pulse rounded"
                  style={{ width: `${Math.random() * 50 + 30}%` }}
                />
                <div className="w-16 h-4 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </Card>

        {/* 시간대별 차트 스켈레톤 */}
        <Card className="p-4">
          <div className="w-32 h-5 bg-muted animate-pulse rounded mb-3" />
          <div className="flex items-end h-32 gap-1">
            {Array.from({ length: 24 }, (_, i) => (
              <div
                key={i}
                className="flex-1 bg-muted animate-pulse rounded-t"
                style={{ height: `${Math.random() * 80 + 10}%` }}
              />
            ))}
          </div>
        </Card>
        <span className="sr-only">데이터를 불러오는 중입니다</span>
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

        <Card className="p-6 bg-destructive/10 border-destructive/30">
          <div className="flex flex-col items-center text-center">
            <svg
              className="w-12 h-12 text-destructive mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="text-lg font-semibold text-destructive mb-2">
              데이터를 불러올 수 없습니다
            </h2>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={() => fetchStats(1, true)} variant="outline">
              다시 시도
            </Button>
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
      <nav className="flex gap-2 mb-4" role="tablist" aria-label="조회 기간 선택">
        {[7, 14, 30, 90].map((d) => (
          <Button
            key={d}
            variant={days === d ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDays(d)}
            role="tab"
            aria-selected={days === d}
            aria-label={`최근 ${d}일 데이터 조회`}
            className="min-w-[44px] min-h-[44px]"
          >
            {d}일
          </Button>
        ))}
      </nav>

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
          <p className="text-muted-foreground">아직 수집된 도착 기록이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <SummaryCard
            totalCount={stats.totalCount}
            avgInterval={stats.avgInterval}
            firstArrival={stats.firstArrival}
            lastArrival={stats.lastArrival}
            stdDeviation={stats.stdDeviation}
          />

          <WeekdayWeekendCard
            weekdayStats={stats.weekdayStats}
            weekendStats={stats.weekendStats}
          />

          <DayStatsChart byDay={stats.byDay} />

          <HourStatsChart byHour={stats.byHour} />

          {/* 페어 정류장 분석 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔗</span>
                <h3 className="font-semibold">페어 정류장 분석</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPairModalOpen(true)}
              >
                + 페어 추가
              </Button>
            </div>

            {pairsLoading ? (
              <Card className="p-4">
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              </Card>
            ) : pairs.length === 0 ? (
              <Card className="p-4">
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">설정된 페어 정류장이 없습니다.</p>
                  <p className="text-xs mt-1">
                    페어를 추가하면 두 정류장 간 소요시간을 분석할 수 있습니다.
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {pairs.map((pair) => (
                  <PairAnalysisCard
                    key={pair.id}
                    pair={pair}
                    days={days}
                    onDelete={handlePairDelete}
                  />
                ))}
              </div>
            )}
          </div>

          <ArrivalLogsList
            logs={currentLogs}
            pagination={pagination}
            currentPage={currentPage}
            logsPerPage={logsPerPage}
            editMode={editMode}
            deletingId={deletingId}
            logsLoading={logsLoading}
            onToggleEditMode={() => setEditMode(!editMode)}
            onDeleteLog={handleDeleteLog}
            onPageChange={goToPage}
          />
        </div>
      )}

      {/* 페어 설정 모달 */}
      <PairSetupModal
        isOpen={pairModalOpen}
        onClose={() => setPairModalOpen(false)}
        onSuccess={fetchPairs}
        preSelectedBusId={busId || undefined}
        preSelectedBusNo={busNo}
      />
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
