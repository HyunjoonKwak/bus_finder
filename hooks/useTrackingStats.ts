'use client';

import { useState, useCallback } from 'react';
import type { Stats, Pagination, ArrivalLog } from '@/types/stats';

interface UseTrackingStatsOptions {
  busId: string | null;
  stationId: string | null;
  logsPerPage?: number;
}

interface UseTrackingStatsReturn {
  stats: Stats | null;
  pagination: Pagination | null;
  currentLogs: ArrivalLog[];
  loading: boolean;
  logsLoading: boolean;
  error: string | null;
  days: number;
  currentPage: number;
  setDays: (days: number) => void;
  fetchStats: (page?: number, isInitial?: boolean) => Promise<void>;
  goToPage: (page: number) => void;
  refreshStats: () => Promise<void>;
}

export function useTrackingStats({
  busId,
  stationId,
  logsPerPage = 20,
}: UseTrackingStatsOptions): UseTrackingStatsReturn {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [currentLogs, setCurrentLogs] = useState<ArrivalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchStats = useCallback(
    async (page: number = 1, isInitial: boolean = false) => {
      if (!busId || !stationId) return;

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

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= (pagination?.totalPages || 1) && !logsLoading) {
        fetchStats(page, false);
      }
    },
    [pagination?.totalPages, logsLoading, fetchStats]
  );

  const refreshStats = useCallback(() => {
    return fetchStats(currentPage, false);
  }, [fetchStats, currentPage]);

  const handleSetDays = useCallback((newDays: number) => {
    setDays(newDays);
    setCurrentPage(1);
  }, []);

  return {
    stats,
    pagination,
    currentLogs,
    loading,
    logsLoading,
    error,
    days,
    currentPage,
    setDays: handleSetDays,
    fetchStats,
    goToPage,
    refreshStats,
  };
}
