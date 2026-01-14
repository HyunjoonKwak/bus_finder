'use client';

import { useEffect, useRef, useCallback } from 'react';

const COLLECTION_INTERVAL = 3 * 60 * 1000; // 3분마다 체크 (하루 약 480회)
const DUPLICATE_PREVENTION_TIME = 3 * 60 * 1000; // 3분 내 중복 기록 방지
const ARRIVAL_IMMINENT_THRESHOLD = 180; // 3분 이내면 "곧 도착" 상태로 간주

interface PendingArrival {
  bus_id: string;
  bus_no: string;
  station_id: string;
  station_name: string;
  arrivalSec: number;
  timestamp: number;
}

interface TrackingTarget {
  bus_id: string;
  bus_no: string;
  station_id: string;
  station_name: string;
  ars_id?: string;
  is_active: boolean;
}

interface ArrivalInfo {
  routeId?: string;
  routeName?: string;
  predictTime1?: number;
}

export function BackgroundCollector() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  // 최근 기록한 버스 추적 (bus_id|station_id -> timestamp)
  const recentlyLoggedRef = useRef<Map<string, number>>(new Map());
  // 곧 도착 상태였던 버스 추적 (bus_id|station_id -> PendingArrival)
  const pendingArrivalsRef = useRef<Map<string, PendingArrival>>(new Map());

  // logArrival을 collectArrivals보다 먼저 선언
  const logArrival = useCallback(async (pending: PendingArrival, now: number) => {
    const logKey = `${pending.bus_id}|${pending.station_id}`;

    // 중복 기록 방지
    const lastLoggedTime = recentlyLoggedRef.current.get(logKey);
    if (lastLoggedTime && now - lastLoggedTime < DUPLICATE_PREVENTION_TIME) {
      console.log(`[BG] Skipped (duplicate): ${pending.bus_no} @ ${pending.station_name}`);
      return;
    }

    try {
      const arrivalTime = new Date().toISOString();
      const logResponse = await fetch('/api/tracking/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bus_id: pending.bus_id,
          bus_no: pending.bus_no,
          station_id: pending.station_id,
          station_name: pending.station_name,
          arrival_time: arrivalTime,
        }),
      });

      if (logResponse.ok) {
        recentlyLoggedRef.current.set(logKey, now);
        console.log(`[BG] Logged: ${pending.bus_no} @ ${pending.station_name}`);
      }
    } catch (logError) {
      console.error('[BG] Log error:', logError);
    }
  }, []);

  const collectArrivals = useCallback(async () => {
    try {
      // 설정 확인
      const settingsResponse = await fetch('/api/settings');
      if (!settingsResponse.ok) return;

      const settingsData = await settingsResponse.json();
      if (!settingsData.settings?.bg_collection_enabled) {
        return; // 백그라운드 수집 비활성화
      }

      const targetsResponse = await fetch('/api/tracking/targets');
      if (!targetsResponse.ok) return;

      const targetsData = await targetsResponse.json();
      const activeTargets = (targetsData.targets || []).filter((t: TrackingTarget) => t.is_active);

      if (activeTargets.length === 0) {
        return;
      }

      console.log('[BG] Collecting arrivals...');

      const stationMap = new Map<string, TrackingTarget[]>();
      for (const target of activeTargets) {
        const key = `${target.station_id}|${target.ars_id || ''}`;
        const existing = stationMap.get(key) || [];
        existing.push(target);
        stationMap.set(key, existing);
      }

      // 이번 수집에서 확인된 버스들
      const currentBusKeys = new Set<string>();

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
            const logKey = `${target.bus_id}|${target.station_id}`;

            const busArrival = arrivals.find((a: ArrivalInfo) => {
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

            const arrivalSec = busArrival?.predictTime1 ? busArrival.predictTime1 * 60 : null;
            const now = Date.now();

            // 버스가 곧 도착 상태인 경우 (3분 이내)
            if (arrivalSec !== null && arrivalSec <= ARRIVAL_IMMINENT_THRESHOLD) {
              currentBusKeys.add(logKey);

              // pendingArrivals에 추가/업데이트
              if (!pendingArrivalsRef.current.has(logKey)) {
                console.log(`[BG] ${target.bus_no} @ ${target.station_name}: ${arrivalSec}초 남음 (추적 시작)`);
              }
              pendingArrivalsRef.current.set(logKey, {
                bus_id: target.bus_id,
                bus_no: target.bus_no,
                station_id: target.station_id,
                station_name: target.station_name,
                arrivalSec,
                timestamp: now,
              });
            }
            // 버스가 3분 이상 남은 경우
            else if (arrivalSec !== null && arrivalSec > ARRIVAL_IMMINENT_THRESHOLD) {
              // 이전에 "곧 도착" 상태였다면 → 버스가 도착했다고 판단
              const pending = pendingArrivalsRef.current.get(logKey);
              if (pending) {
                console.log(`[BG] ${target.bus_no} @ ${target.station_name}: 다음 버스로 변경됨 → 도착 기록`);
                await logArrival(pending, now);
                pendingArrivalsRef.current.delete(logKey);
              }
            }
          }
        } catch (stationError) {
          console.error('[BG] Station error:', stationError);
        }
      }

      // pendingArrivals 중 현재 수집에서 확인되지 않은 버스들 → 도착했다고 판단
      const now = Date.now();
      for (const [logKey, pending] of pendingArrivalsRef.current) {
        if (!currentBusKeys.has(logKey)) {
          // 마지막 업데이트로부터 일정 시간이 지났으면 도착으로 간주
          const elapsed = now - pending.timestamp;
          if (elapsed > 60 * 1000) { // 1분 이상 업데이트 없으면
            console.log(`[BG] ${pending.bus_no} @ ${pending.station_name}: 정보 없음 → 도착 기록`);
            await logArrival(pending, now);
            pendingArrivalsRef.current.delete(logKey);
          }
        }
      }

      console.log('[BG] Collection complete');
    } catch (error) {
      console.error('[BG] Collection error:', error);
    }
  }, [logArrival]);

  useEffect(() => {
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    // 30초마다 수집
    intervalRef.current = setInterval(collectArrivals, COLLECTION_INTERVAL);

    // 컴포넌트 마운트 시 즉시 한 번 실행
    collectArrivals();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [collectArrivals]);

  // UI 없는 백그라운드 컴포넌트
  return null;
}
