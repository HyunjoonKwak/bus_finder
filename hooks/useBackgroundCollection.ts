'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 서버 스케줄러 기반 백그라운드 수집 상태 관리 훅
 *
 * Settings 페이지의 스케줄러와 동일한 API를 사용하여
 * Tracking 페이지에서도 스케줄러를 제어할 수 있습니다.
 */

interface SchedulerStatus {
  isRunning: boolean;
  intervalMinutes: number;
  lastRun: string | null;
  lastResult: {
    arrivals: { checked: number; logged: number };
    lastBusAlerts: { checked: number; sent: number };
  } | null;
  activeTimers?: number;
  dbSettings?: {
    enabled: boolean;
    intervalMinutes: number;
    startHour: number;
    endHour: number;
  } | null;
}

interface CollectionStatus {
  isRunning: boolean;
  lastCollected: Date | null;
  logs: Array<{ bus_no: string; station_name: string; arrival_time: string }>;
  isLoading: boolean;
  schedulerStatus: SchedulerStatus | null;
}

export function useBackgroundCollection() {
  const [status, setStatus] = useState<CollectionStatus>({
    isRunning: false,
    lastCollected: null,
    logs: [],
    isLoading: true,
    schedulerStatus: null,
  });
  const isInitializedRef = useRef(false);

  // 스케줄러 상태 조회
  const fetchSchedulerStatus = useCallback(async (): Promise<SchedulerStatus | null> => {
    try {
      const response = await fetch('/api/cron/scheduler');
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    } catch (error) {
      console.error('[BG] Failed to fetch scheduler status:', error);
    }
    return null;
  }, []);

  // 서버에서 최근 기록 로드
  const loadRecentLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/tracking/logs?limit=10');
      if (response.ok) {
        const data = await response.json();
        return data.logs || [];
      }
    } catch (error) {
      console.error('[BG] Failed to load logs:', error);
    }
    return [];
  }, []);

  // 초기화: 스케줄러 상태 및 기록 로드
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initialize = async () => {
      const [schedulerStatus, logs] = await Promise.all([
        fetchSchedulerStatus(),
        loadRecentLogs(),
      ]);

      setStatus({
        isRunning: schedulerStatus?.isRunning || false,
        lastCollected: schedulerStatus?.lastRun ? new Date(schedulerStatus.lastRun) : null,
        logs,
        isLoading: false,
        schedulerStatus,
      });
    };

    initialize();
  }, [fetchSchedulerStatus, loadRecentLogs]);

  // 스케줄러 시작 (실제 서버 스케줄러 제어)
  const startCollection = useCallback(async () => {
    try {
      const response = await fetch('/api/cron/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          intervalMinutes: 5,
          startHour: 5,
          endHour: 24,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setStatus((prev) => ({
          ...prev,
          isRunning: data.isRunning,
          schedulerStatus: data,
        }));
        return true;
      }
    } catch (error) {
      console.error('[BG] Failed to start scheduler:', error);
    }
    return false;
  }, []);

  // 스케줄러 중지 (실제 서버 스케줄러 제어)
  const stopCollection = useCallback(async () => {
    try {
      const response = await fetch('/api/cron/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });

      if (response.ok) {
        const data = await response.json();
        setStatus((prev) => ({
          ...prev,
          isRunning: data.isRunning,
          schedulerStatus: data,
        }));
        return true;
      }
    } catch (error) {
      console.error('[BG] Failed to stop scheduler:', error);
    }
    return false;
  }, []);

  // 로그 새로고침
  const refreshLogs = useCallback(async () => {
    const [schedulerStatus, logs] = await Promise.all([
      fetchSchedulerStatus(),
      loadRecentLogs(),
    ]);

    setStatus((prev) => ({
      ...prev,
      logs,
      isRunning: schedulerStatus?.isRunning || false,
      lastCollected: schedulerStatus?.lastRun ? new Date(schedulerStatus.lastRun) : prev.lastCollected,
      schedulerStatus,
    }));
  }, [fetchSchedulerStatus, loadRecentLogs]);

  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }, []);

  return {
    ...status,
    startCollection,
    stopCollection,
    refreshLogs,
    requestNotificationPermission,
  };
}
