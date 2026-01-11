'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 서버 기반 백그라운드 수집 상태 조회 훅
 *
 * 수집은 서버 Cron에서 처리하므로, 이 훅은:
 * - 수집 활성화/비활성화 설정만 관리
 * - 최근 기록 조회
 */

interface CollectionStatus {
  isRunning: boolean;
  lastCollected: Date | null;
  logs: Array<{ bus_no: string; station_name: string; arrival_time: string }>;
  isLoading: boolean;
}

export function useBackgroundCollection() {
  const [status, setStatus] = useState<CollectionStatus>({
    isRunning: false,
    lastCollected: null,
    logs: [],
    isLoading: true,
  });
  const isInitializedRef = useRef(false);

  // 서버에서 설정 로드
  const loadSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const data = await response.json();
        return data.settings?.bg_collection_enabled || false;
      }
    } catch (error) {
      console.error('[BG] Failed to load settings:', error);
    }
    return false;
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

  // 서버에 설정 저장
  const saveSettings = useCallback(async (enabled: boolean) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bg_collection_enabled: enabled }),
      });
    } catch (error) {
      console.error('[BG] Failed to save settings:', error);
    }
  }, []);

  // 초기화: 서버에서 설정 및 기록 로드
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initialize = async () => {
      const [enabled, logs] = await Promise.all([
        loadSettings(),
        loadRecentLogs(),
      ]);

      setStatus({
        isRunning: enabled,
        lastCollected: logs.length > 0 ? new Date(logs[0].arrival_time) : null,
        logs,
        isLoading: false,
      });
    };

    initialize();
  }, [loadSettings, loadRecentLogs]);

  const startCollection = useCallback(async () => {
    setStatus((prev) => ({ ...prev, isRunning: true }));
    await saveSettings(true);
  }, [saveSettings]);

  const stopCollection = useCallback(async () => {
    setStatus((prev) => ({ ...prev, isRunning: false }));
    await saveSettings(false);
  }, [saveSettings]);

  const refreshLogs = useCallback(async () => {
    const logs = await loadRecentLogs();
    setStatus((prev) => ({
      ...prev,
      logs,
      lastCollected: logs.length > 0 ? new Date(logs[0].arrival_time) : prev.lastCollected,
    }));
  }, [loadRecentLogs]);

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
