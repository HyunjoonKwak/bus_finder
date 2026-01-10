'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const COLLECTION_INTERVAL = 5 * 60 * 1000; // 5분

interface CollectionStatus {
  isRunning: boolean;
  lastCollected: Date | null;
  logs: Array<{ bus_no: string; station_name: string; timestamp: string }>;
  isLoading: boolean;
}

export function useBackgroundCollection() {
  const [status, setStatus] = useState<CollectionStatus>({
    isRunning: false,
    lastCollected: null,
    logs: [],
    isLoading: true,
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
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
      console.error('Failed to load settings:', error);
    }
    return false;
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
      console.error('Failed to save settings:', error);
    }
  }, []);

  // 수집 실행
  const collectArrivals = useCallback(async () => {
    console.log('[BG] Collecting arrivals...');
    try {
      const targetsResponse = await fetch('/api/tracking/targets');
      if (!targetsResponse.ok) return;

      const targetsData = await targetsResponse.json();
      const activeTargets = (targetsData.targets || []).filter((t: any) => t.is_active);

      if (activeTargets.length === 0) {
        console.log('[BG] No active targets');
        setStatus((prev) => ({
          ...prev,
          lastCollected: new Date(),
        }));
        return;
      }

      const stationMap = new Map<string, any[]>();
      for (const target of activeTargets) {
        const key = `${target.station_id}|${target.ars_id || ''}`;
        const existing = stationMap.get(key) || [];
        existing.push(target);
        stationMap.set(key, existing);
      }

      const collectedLogs: Array<{ bus_no: string; station_name: string; arrivalSec: number }> = [];

      for (const [stationKey, stationTargets] of stationMap) {
        try {
          const [stationId, arsId] = stationKey.split('|');
          const params = new URLSearchParams({ stationId });
          if (arsId) params.append('arsId', arsId);

          const arrivalResponse = await fetch(`/api/bus/arrival?${params.toString()}`);
          if (!arrivalResponse.ok) continue;

          const arrivalData = await arrivalResponse.json();
          const arrivals = arrivalData.arrivals || [];

          for (const target of stationTargets) {
            const busArrival = arrivals.find((a: any) => {
              const aRouteId = String(a.routeId || '');
              const aRouteName = String(a.routeName || '');
              const tBusId = String(target.bus_id || '');
              const tBusNo = String(target.bus_no || '');
              return (
                aRouteId === tBusId ||
                aRouteName === tBusNo ||
                aRouteName.replace(/\s/g, '') === tBusNo.replace(/\s/g, '')
              );
            });

            // 도착 임박 시 자동 기록 (1분 30초 이내)
            const arrivalSec = busArrival?.predictTime1 ? busArrival.predictTime1 * 60 : null;
            if (arrivalSec !== null && arrivalSec <= 90) {
              try {
                const arrivalTime = new Date(Date.now() + arrivalSec * 1000).toISOString();
                const logResponse = await fetch('/api/tracking/logs', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    bus_id: target.bus_id,
                    bus_no: target.bus_no,
                    station_id: target.station_id,
                    station_name: target.station_name,
                    arrival_time: arrivalTime,
                  }),
                });

                if (logResponse.ok) {
                  collectedLogs.push({
                    bus_no: target.bus_no,
                    station_name: target.station_name,
                    arrivalSec,
                  });
                  console.log(`[BG] Logged: ${target.bus_no} @ ${target.station_name} (${arrivalSec}초)`);
                }
              } catch (logError) {
                console.error('[BG] Log error:', logError);
              }
            }
          }
        } catch (stationError) {
          console.error('[BG] Station error:', stationError);
        }
      }

      // 상태 업데이트
      const timestamp = new Date().toISOString();
      if (collectedLogs.length > 0) {
        setStatus((prev) => ({
          ...prev,
          lastCollected: new Date(timestamp),
          logs: [
            ...collectedLogs.map((log) => ({ ...log, timestamp })),
            ...prev.logs.slice(0, 50),
          ],
        }));
      } else {
        setStatus((prev) => ({
          ...prev,
          lastCollected: new Date(timestamp),
        }));
      }

      console.log(`[BG] Collection complete. Logged ${collectedLogs.length} arrivals.`);
    } catch (error) {
      console.error('[BG] Collection error:', error);
    }
  }, []);

  // 수집 인터벌 시작
  const startCollectionInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // 즉시 한 번 실행
    collectArrivals();

    // 5분마다 반복
    intervalRef.current = setInterval(() => {
      collectArrivals();
    }, COLLECTION_INTERVAL);
  }, [collectArrivals]);

  // 수집 인터벌 중지
  const stopCollectionInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // 초기화: 서버에서 설정 로드
  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    const initialize = async () => {
      const enabled = await loadSettings();
      setStatus((prev) => ({
        ...prev,
        isRunning: enabled,
        isLoading: false,
      }));

      if (enabled) {
        startCollectionInterval();
      }
    };

    initialize();
  }, [loadSettings, startCollectionInterval]);

  // 컴포넌트 언마운트 시 인터벌 정리 (상태는 서버에 저장되어 있음)
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startCollection = useCallback(async () => {
    setStatus((prev) => ({ ...prev, isRunning: true }));
    await saveSettings(true);
    startCollectionInterval();
  }, [saveSettings, startCollectionInterval]);

  const stopCollection = useCallback(async () => {
    setStatus((prev) => ({ ...prev, isRunning: false }));
    await saveSettings(false);
    stopCollectionInterval();
  }, [saveSettings, stopCollectionInterval]);

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
    requestNotificationPermission,
  };
}
