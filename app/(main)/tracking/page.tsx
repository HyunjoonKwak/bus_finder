'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBackgroundCollection } from '@/hooks/useBackgroundCollection';

interface TrackingTarget {
  id: string;
  bus_id: string;
  bus_no: string;
  station_id: string;
  station_name: string;
  ars_id?: string;
  is_active: boolean;
  created_at: string;
}

interface ArrivalInfo {
  arrivalSec: number;
  leftStation: number;
}

interface TargetWithArrival extends TrackingTarget {
  arrival?: ArrivalInfo;
  lastChecked?: Date;
}

const REFRESH_OPTIONS = [
  { value: 30, label: '30초' },
  { value: 60, label: '1분' },
  { value: 120, label: '2분' },
  { value: 300, label: '5분' },
  { value: 0, label: '수동' },
];

const DEFAULT_REFRESH_INTERVAL = 30;

export default function TrackingPage() {
  const router = useRouter();
  const [targets, setTargets] = useState<TargetWithArrival[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(DEFAULT_REFRESH_INTERVAL);
  const [countdown, setCountdown] = useState(DEFAULT_REFRESH_INTERVAL);
  const [collecting, setCollecting] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const targetsRef = useRef<TargetWithArrival[]>([]);

  useEffect(() => {
    targetsRef.current = targets;
  }, [targets]);

  const {
    isRunning: bgCollecting,
    isLoading: bgLoading,
    lastCollected,
    logs: bgLogs,
    schedulerStatus,
    startCollection,
    stopCollection,
    requestNotificationPermission,
  } = useBackgroundCollection();

  const fetchTargets = async () => {
    try {
      const response = await fetch('/api/tracking/targets');
      const data = await response.json();
      setTargets(data.targets || []);
    } catch (error) {
      console.error('Fetch targets error:', error);
    } finally {
      setLoading(false);
    }
  };

  const checkArrivals = useCallback(async () => {
    const currentTargets = targetsRef.current;
    if (currentTargets.length === 0) return;

    setCollecting(true);
    const activeTargets = currentTargets.filter((t) => t.is_active);

    if (activeTargets.length === 0) {
      setCollecting(false);
      return;
    }

    const stationMap = new Map<string, TargetWithArrival[]>();
    for (const target of activeTargets) {
      const key = `${target.station_id}|${target.ars_id || ''}`;
      const existing = stationMap.get(key) || [];
      existing.push(target);
      stationMap.set(key, existing);
    }

    const updatedTargets = [...currentTargets];

    for (const [stationKey, stationTargets] of stationMap) {
      try {
        const [stationId, arsId] = stationKey.split('|');
        const params = new URLSearchParams({ stationId });
        if (arsId) params.append('arsId', arsId);

        const response = await fetch(`/api/bus/arrival?${params.toString()}`);
        const data = await response.json();
        const arrivals = data.arrivals || [];

        for (const target of stationTargets) {
          interface ArrivalInfo {
            routeId?: string;
            routeName?: string;
            predictTime1?: number;
            locationNo1?: number;
          }
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

          const targetIndex = updatedTargets.findIndex((t) => t.id === target.id);
          if (targetIndex >= 0) {
            updatedTargets[targetIndex] = {
              ...updatedTargets[targetIndex],
              arrival: busArrival ? {
                arrivalSec: busArrival.predictTime1 ? busArrival.predictTime1 * 60 : 0,
                leftStation: busArrival.locationNo1 || 0,
              } : undefined,
              lastChecked: new Date(),
            };
          }
        }
      } catch (error) {
        console.error(`Station fetch error:`, error);
      }
    }

    setTargets(updatedTargets);
    setCollecting(false);
  }, []);

  // localStorage에서 리프레시 간격 로드
  useEffect(() => {
    const savedRefresh = localStorage.getItem('tracking_refresh_interval');
    if (savedRefresh) {
      const interval = parseInt(savedRefresh);
      if (!isNaN(interval)) {
        setRefreshInterval(interval);
        setCountdown(interval || DEFAULT_REFRESH_INTERVAL);
      }
    }
  }, []);

  useEffect(() => {
    fetchTargets();

    if ('Notification' in window) {
      setNotificationEnabled(Notification.permission === 'granted');
    }
  }, []);

  useEffect(() => {
    if (loading) return;

    const hasActiveTargets = targets.some((t) => t.is_active);
    if (targets.length === 0 || !hasActiveTargets) return;

    checkArrivals();

    // 수동 모드(0)면 타이머 설정 안 함
    if (refreshInterval === 0) return;

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          checkArrivals();
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [loading, targets.length, checkArrivals, refreshInterval]);

  const handleToggle = async (target: TrackingTarget) => {
    try {
      await fetch('/api/tracking/targets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target.id, is_active: !target.is_active }),
      });
      fetchTargets();
    } catch (error) {
      console.error('Toggle target error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 추적 대상을 삭제하시겠습니까?')) return;

    try {
      await fetch(`/api/tracking/targets?id=${id}`, { method: 'DELETE' });
      fetchTargets();
    } catch (error) {
      console.error('Delete target error:', error);
    }
  };

  const handleViewStats = (target: TrackingTarget) => {
    router.push(
      `/tracking/stats?bus_id=${target.bus_id}&station_id=${target.station_id}&bus_no=${encodeURIComponent(target.bus_no)}&station_name=${encodeURIComponent(target.station_name)}`
    );
  };

  const handleToggleBgCollection = async () => {
    if (bgCollecting) {
      stopCollection();
    } else {
      if (!notificationEnabled) {
        const granted = await requestNotificationPermission();
        setNotificationEnabled(granted);
      }
      startCollection();
    }
  };

  const handleRefreshIntervalChange = (interval: number) => {
    setRefreshInterval(interval);
    setCountdown(interval || DEFAULT_REFRESH_INTERVAL);
    localStorage.setItem('tracking_refresh_interval', interval.toString());
  };

  const formatArrivalTime = (sec: number) => {
    if (sec < 60) return '곧 도착';
    const min = Math.floor(sec / 60);
    return `${min}분`;
  };

  const formatLastCollected = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-foreground mb-4">버스 도착 추적</h1>
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  const activeTargets = targets.filter((t) => t.is_active);

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-foreground">버스 도착 추적</h1>
        {targets.length > 0 && (
          <Button
            variant={bgCollecting ? 'default' : 'outline'}
            size="sm"
            onClick={handleToggleBgCollection}
            disabled={bgLoading}
          >
            {bgLoading ? '로딩...' : bgCollecting ? '자동수집 ON' : '자동수집 OFF'}
          </Button>
        )}
      </div>

      {/* 백그라운드 수집 상태 */}
      {bgCollecting && (
        <Card className="p-3 mb-4 bg-green-500/10 border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">자동 수집 활성화</p>
              <p className="text-xs text-green-600/70 dark:text-green-400/70 mt-1">
                {schedulerStatus?.dbSettings
                  ? `${schedulerStatus.dbSettings.intervalMinutes}분 간격 (${schedulerStatus.dbSettings.startHour}:00~${schedulerStatus.dbSettings.endHour === 24 ? '24:00' : schedulerStatus.dbSettings.endHour + ':00'})`
                  : '서버에서 자동으로 도착 정보를 수집합니다.'}
              </p>
            </div>
            {lastCollected && (
              <div className="text-right">
                <p className="text-xs text-green-600/70 dark:text-green-400/70">마지막</p>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">
                  {formatLastCollected(lastCollected)}
                </p>
              </div>
            )}
          </div>
          {/* 활성 타이머 정보 */}
          {schedulerStatus?.activeTimers !== undefined && schedulerStatus.activeTimers > 0 && (
            <div className="mt-2 pt-2 border-t border-green-500/20">
              <p className="text-xs text-green-600/70 dark:text-green-400/70">
                ⏱️ 활성 타이머: {schedulerStatus.activeTimers}개
              </p>
            </div>
          )}
        </Card>
      )}

      {/* 최근 자동 수집 기록 */}
      {bgLogs.length > 0 && (
        <Card className="p-3 mb-4">
          <p className="text-sm font-medium text-foreground mb-2">최근 자동 수집 기록</p>
          <div className="space-y-1">
            {bgLogs.slice(0, 3).map((log, idx) => (
              <p key={idx} className="text-xs text-muted-foreground">
                {log.bus_no}번 @ {log.station_name} - {new Date(log.arrival_time).toLocaleTimeString('ko-KR')}
              </p>
            ))}
          </div>
        </Card>
      )}

      {/* 실시간 도착 정보 */}
      {activeTargets.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-foreground">실시간 도착 정보</h3>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {collecting ? (
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>확인 중...</span>
              </div>
            ) : (
              <>
                <select
                  value={refreshInterval}
                  onChange={(e) => handleRefreshIntervalChange(parseInt(e.target.value))}
                  className="text-xs border rounded px-2 py-1 bg-background"
                  title="새로고침 간격"
                >
                  {REFRESH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {refreshInterval > 0 && (
                  <span className="text-xs">{countdown}초</span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    checkArrivals();
                    setCountdown(refreshInterval || DEFAULT_REFRESH_INTERVAL);
                  }}
                >
                  새로고침
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {targets.length === 0 ? (
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
          <p className="text-muted-foreground mb-2">추적 중인 버스가 없습니다.</p>
          <p className="text-sm text-muted-foreground/70 mb-4">
            정류소 상세 페이지에서 버스를 추적 대상으로 추가하세요.
          </p>
          <Button onClick={() => router.push('/station/search')}>
            정류소 검색
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {targets.map((target) => (
              <Card key={target.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg text-primary">
                        {target.bus_no}
                      </span>
                      <Badge variant={target.is_active ? 'default' : 'secondary'}>
                        {target.is_active ? '활성' : '비활성'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {target.station_name}
                    </p>

                    {/* 실시간 도착 정보 */}
                    {target.is_active && target.arrival && (
                      <div className="mt-2 flex items-center gap-2">
                        <span
                          className={`text-lg font-bold ${
                            target.arrival.arrivalSec <= 120
                              ? 'text-red-500'
                              : target.arrival.arrivalSec <= 300
                              ? 'text-amber-500'
                              : 'text-primary'
                          }`}
                        >
                          {formatArrivalTime(target.arrival.arrivalSec)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({target.arrival.leftStation}정류장 전)
                        </span>
                      </div>
                    )}
                    {target.is_active && !target.arrival && target.lastChecked && (
                      <p className="text-xs text-muted-foreground mt-2">
                        도착 정보 없음
                      </p>
                    )}
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => handleToggle(target)}
                      className="p-2 text-muted-foreground hover:text-foreground"
                      title={target.is_active ? '비활성화' : '활성화'}
                    >
                      {target.is_active ? (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(target.id)}
                      className="p-2 text-muted-foreground hover:text-destructive"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleViewStats(target)}
                  >
                    통계 보기
                  </Button>
                </div>
              </Card>
          ))}
        </div>
      )}

      {/* 도움말 */}
      <p className="text-xs text-muted-foreground text-center mt-6">
        💡 정류소 상세 페이지에서 버스를 추적 대상으로 추가할 수 있습니다.
      </p>
    </div>
  );
}
