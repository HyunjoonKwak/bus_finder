'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  SummaryCard,
  WeekdayWeekendCard,
  DayStatsChart,
  HourStatsChart,
  ArrivalLogsList,
  PairAnalysisCard,
  StatsPageSkeleton,
  StatsPageError,
} from '@/components/tracking/stats';
import { PairSetupModal } from '@/components/tracking/PairSetupModal';
import { useTrackingStats } from '@/hooks/useTrackingStats';
import { useTrackingPairs } from '@/hooks/useTrackingPairs';
import { exportStatsToCSV } from '@/lib/export-csv';

function StatsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const busId = searchParams.get('bus_id');
  const stationId = searchParams.get('station_id');
  const busNo = searchParams.get('bus_no') || '';
  const stationName = searchParams.get('station_name') || '';

  // 커스텀 훅 사용
  const {
    stats,
    pagination,
    currentLogs,
    loading,
    logsLoading,
    error,
    days,
    currentPage,
    setDays,
    fetchStats,
    goToPage,
    refreshStats,
  } = useTrackingStats({ busId, stationId });

  const { pairs, loading: pairsLoading, fetchPairs, deletePair } = useTrackingPairs({
    busId,
    stationId,
  });

  // 로컬 UI 상태
  const [editMode, setEditMode] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pairModalOpen, setPairModalOpen] = useState(false);

  // 초기 데이터 로드
  useEffect(() => {
    if (busId && stationId) {
      fetchStats(1, true);
      fetchPairs();
    }
  }, [busId, stationId, days, fetchStats, fetchPairs]);

  // 도착 기록 삭제
  const handleDeleteLog = async (logId: string) => {
    if (!confirm('이 도착 기록을 삭제하시겠습니까?')) return;

    setDeletingId(logId);
    try {
      const response = await fetch(`/api/tracking/logs?id=${logId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await refreshStats();
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
    if (!stats || !busId || !stationId) return;

    try {
      await exportStatsToCSV({ busId, stationId, days, busNo, stationName });
    } catch {
      alert('CSV 내보내기에 실패했습니다.');
    }
  };

  // 잘못된 접근
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

  // 로딩 UI
  if (loading) {
    return <StatsPageSkeleton />;
  }

  // 에러 UI
  if (error) {
    return (
      <StatsPageError
        error={error}
        onRetry={() => fetchStats(1, true)}
        onBack={() => router.back()}
      />
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
                    onDelete={deletePair}
                  />
                ))}
              </div>
            )}
          </div>

          <ArrivalLogsList
            logs={currentLogs}
            pagination={pagination}
            currentPage={currentPage}
            logsPerPage={20}
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
