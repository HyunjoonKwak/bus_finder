'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useBackgroundCollection } from '@/hooks/useBackgroundCollection';
import { PairAnalysisCard } from '@/components/tracking/stats';
import { PairSetupModal } from '@/components/tracking/PairSetupModal';
import type { StationPair } from '@/types/stats';

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

// API 응답 타입
interface BusArrivalResponse {
  routeId?: string;
  routeName?: string;
  predictTime1?: number;
  locationNo1?: number;
}

interface TargetWithArrival extends TrackingTarget {
  arrival?: ArrivalInfo;
  lastChecked?: Date;
  error?: string;
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
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(DEFAULT_REFRESH_INTERVAL);
  const [countdown, setCountdown] = useState(DEFAULT_REFRESH_INTERVAL);
  const [collecting, setCollecting] = useState(false);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const targetsRef = useRef<TargetWithArrival[]>([]);

  // 페어 관련 상태
  const [pairs, setPairs] = useState<StationPair[]>([]);
  const [pairsLoading, setPairsLoading] = useState(false);
  const [pairModalOpen, setPairModalOpen] = useState(false);

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
      setError(null);
      const response = await fetch('/api/tracking/targets');

      if (!response.ok) {
        throw new Error('추적 대상을 불러오는데 실패했습니다.');
      }

      const data = await response.json();
      setTargets(data.targets || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // 페어 목록 조회
  const fetchPairs = useCallback(async () => {
    try {
      setPairsLoading(true);
      const response = await fetch('/api/tracking/pairs');

      if (response.ok) {
        const data = await response.json();
        setPairs(data.pairs || []);
      }
    } catch {
      // 페어 로드 실패는 무시
    } finally {
      setPairsLoading(false);
    }
  }, []);

  // 페어 삭제 핸들러
  const handlePairDelete = (pairId: string) => {
    setPairs((prev) => prev.filter((p) => p.id !== pairId));
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

    // 정류소별로 그룹핑
    const stationMap = new Map<string, TargetWithArrival[]>();
    for (const target of activeTargets) {
      const key = `${target.station_id}|${target.ars_id || ''}`;
      const existing = stationMap.get(key) || [];
      existing.push(target);
      stationMap.set(key, existing);
    }

    const updatedTargets = [...currentTargets];

    // 병렬로 API 호출
    const fetchPromises = Array.from(stationMap.entries()).map(
      async ([stationKey, stationTargets]) => {
        try {
          const [stationId, arsId] = stationKey.split('|');
          const params = new URLSearchParams({ stationId });
          if (arsId) params.append('arsId', arsId);

          const response = await fetch(`/api/bus/arrival?${params.toString()}`);

          if (!response.ok) {
            throw new Error(`API 오류: ${response.status}`);
          }

          const data = await response.json();
          const arrivals: BusArrivalResponse[] = data.arrivals || [];

          for (const target of stationTargets) {
            const busArrival = arrivals.find((a) => {
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
                arrival: busArrival
                  ? {
                      arrivalSec: busArrival.predictTime1 ? busArrival.predictTime1 * 60 : 0,
                      leftStation: busArrival.locationNo1 || 0,
                    }
                  : undefined,
                lastChecked: new Date(),
                error: undefined,
              };
            }
          }
        } catch (err) {
          // 해당 정류소의 타겟들에 에러 표시
          for (const target of stationTargets) {
            const targetIndex = updatedTargets.findIndex((t) => t.id === target.id);
            if (targetIndex >= 0) {
              updatedTargets[targetIndex] = {
                ...updatedTargets[targetIndex],
                error: '도착 정보를 가져올 수 없습니다.',
                lastChecked: new Date(),
              };
            }
          }
        }
      }
    );

    // 모든 요청 완료 대기
    await Promise.all(fetchPromises);

    setTargets(updatedTargets);
    setCollecting(false);
  }, []);

  // localStorage에서 리프레시 간격 로드
  useEffect(() => {
    try {
      const savedRefresh = localStorage.getItem('tracking_refresh_interval');
      if (savedRefresh) {
        const interval = parseInt(savedRefresh);
        if (!isNaN(interval) && interval >= 0) {
          setRefreshInterval(interval);
          setCountdown(interval || DEFAULT_REFRESH_INTERVAL);
        }
      }
    } catch {
      // localStorage 접근 불가 (시크릿 모드 등)
    }
  }, []);

  useEffect(() => {
    fetchTargets();
    fetchPairs();

    if ('Notification' in window) {
      setNotificationEnabled(Notification.permission === 'granted');
    }
  }, [fetchPairs]);

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
      const response = await fetch('/api/tracking/targets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target.id, is_active: !target.is_active }),
      });

      if (!response.ok) {
        throw new Error('상태 변경에 실패했습니다.');
      }

      fetchTargets();
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 추적 대상을 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/tracking/targets?id=${id}`, { method: 'DELETE' });

      if (!response.ok) {
        throw new Error('삭제에 실패했습니다.');
      }

      fetchTargets();
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.');
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
    try {
      localStorage.setItem('tracking_refresh_interval', interval.toString());
    } catch {
      // localStorage 접근 불가
    }
  };

  const formatArrivalTime = (sec: number) => {
    if (sec < 60) return '곧 도착';
    const min = Math.floor(sec / 60);
    return `${min}분`;
  };

  const getArrivalStatus = (sec: number): { label: string; className: string } => {
    if (sec <= 120) {
      return { label: '임박', className: 'text-red-500' };
    } else if (sec <= 300) {
      return { label: '곧', className: 'text-amber-500' };
    }
    return { label: '', className: 'text-primary' };
  };

  const formatLastCollected = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-foreground mb-4">버스 도착 추적</h1>
        {/* 스켈레톤 로딩 UI */}
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0" role="status" aria-label="로딩 중">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-12 bg-muted rounded" />
                    <div className="h-5 w-14 bg-muted rounded-full" />
                  </div>
                  <div className="h-4 w-32 bg-muted rounded mt-2" />
                </div>
                <div className="flex gap-1">
                  <div className="h-9 w-9 bg-muted rounded" />
                  <div className="h-9 w-9 bg-muted rounded" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-8 w-16 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
              </div>
            </Card>
          ))}
          <span className="sr-only">추적 대상 목록을 불러오는 중...</span>
        </div>
      </div>
    );
  }

  // 에러 UI
  if (error) {
    return (
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-foreground mb-4">버스 도착 추적</h1>
        <Card className="p-6 bg-destructive/10 border-destructive/30">
          <div className="flex flex-col items-center text-center">
            <svg
              className="w-12 h-12 text-destructive mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
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
            <Button onClick={fetchTargets} variant="outline">
              다시 시도
            </Button>
          </div>
        </Card>
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
            aria-pressed={bgCollecting}
            aria-label={bgCollecting ? '자동수집 끄기' : '자동수집 켜기'}
          >
            {bgLoading ? '로딩...' : bgCollecting ? '자동수집 ON' : '자동수집 OFF'}
          </Button>
        )}
      </div>

      {/* 백그라운드 수집 상태 */}
      {bgCollecting && (
        <Card
          className="p-3 mb-4 bg-green-500/10 border-green-500/30"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                자동 수집 활성화
              </p>
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
                <span aria-hidden="true">⏱️</span> 활성 타이머: {schedulerStatus.activeTimers}개
              </p>
            </div>
          )}
        </Card>
      )}

      {/* 최근 자동 수집 기록 */}
      {bgLogs.length > 0 && (
        <Card className="p-3 mb-4" role="region" aria-labelledby="recent-logs-heading">
          <p id="recent-logs-heading" className="text-sm font-medium text-foreground mb-2">
            최근 자동 수집 기록
          </p>
          <div className="space-y-1">
            {bgLogs.slice(0, 3).map((log, idx) => (
              <p key={idx} className="text-xs text-muted-foreground">
                {log.bus_no}번 @ {log.station_name} -{' '}
                {new Date(log.arrival_time).toLocaleTimeString('ko-KR')}
              </p>
            ))}
          </div>
        </Card>
      )}

      {/* 실시간 도착 정보 */}
      {activeTargets.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-foreground">실시간 도착 정보</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {collecting ? (
              <div className="flex items-center gap-2" role="status" aria-live="polite">
                <div
                  className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin"
                  aria-hidden="true"
                />
                <span>확인 중...</span>
              </div>
            ) : (
              <>
                <label htmlFor="refresh-interval" className="sr-only">
                  새로고침 간격 선택
                </label>
                <select
                  id="refresh-interval"
                  value={refreshInterval}
                  onChange={(e) => handleRefreshIntervalChange(parseInt(e.target.value))}
                  className="text-xs border rounded px-2 py-1 bg-background min-h-[32px]"
                  aria-label="새로고침 간격"
                >
                  {REFRESH_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {refreshInterval > 0 && (
                  <span className="text-xs" aria-live="polite">
                    {countdown}초
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    checkArrivals();
                    setCountdown(refreshInterval || DEFAULT_REFRESH_INTERVAL);
                  }}
                  disabled={collecting}
                  aria-label="도착 정보 새로고침"
                  className="min-h-[44px] min-w-[44px]"
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
            aria-hidden="true"
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
          <Button onClick={() => router.push('/station/search')}>정류소 검색</Button>
        </div>
      ) : (
        <div className="space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0" role="list" aria-label="추적 대상 버스 목록">
          {targets.map((target) => {
            const arrivalStatus = target.arrival ? getArrivalStatus(target.arrival.arrivalSec) : null;

            return (
              <Card
                key={target.id}
                className="p-4"
                role="listitem"
                aria-label={`${target.bus_no}번 버스, ${target.station_name} 정류소`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg text-primary">{target.bus_no}</span>
                      <Badge variant={target.is_active ? 'default' : 'secondary'}>
                        {target.is_active ? '활성' : '비활성'}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{target.station_name}</p>

                    {/* 실시간 도착 정보 */}
                    {target.is_active && target.arrival && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-lg font-bold ${arrivalStatus?.className}`}>
                          {formatArrivalTime(target.arrival.arrivalSec)}
                        </span>
                        {/* 색상 외 텍스트로도 상태 표시 (접근성) */}
                        {arrivalStatus?.label && (
                          <Badge
                            variant="outline"
                            className={
                              arrivalStatus.label === '임박'
                                ? 'border-red-500 text-red-500'
                                : 'border-amber-500 text-amber-500'
                            }
                          >
                            {arrivalStatus.label}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          ({target.arrival.leftStation}정류장 전)
                        </span>
                      </div>
                    )}
                    {target.is_active && target.error && (
                      <p className="text-xs text-destructive mt-2">{target.error}</p>
                    )}
                    {target.is_active && !target.arrival && !target.error && target.lastChecked && (
                      <p className="text-xs text-muted-foreground mt-2">도착 정보 없음</p>
                    )}
                  </div>

                  <div className="flex gap-1">
                    <button
                      onClick={() => handleToggle(target)}
                      className="p-2 text-muted-foreground hover:text-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
                      aria-label={target.is_active ? '추적 비활성화' : '추적 활성화'}
                      aria-pressed={target.is_active}
                    >
                      {target.is_active ? (
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                        </svg>
                      ) : (
                        <svg
                          className="w-5 h-5"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(target.id)}
                      className="p-2 text-muted-foreground hover:text-destructive min-w-[44px] min-h-[44px] flex items-center justify-center"
                      aria-label={`${target.bus_no}번 버스 추적 삭제`}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
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
            );
          })}
        </div>
      )}

      {/* 페어 정류장 분석 */}
      {targets.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔗</span>
              <h2 className="font-semibold text-foreground">페어 정류장 분석</h2>
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
                  days={30}
                  onDelete={handlePairDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 페어 설정 모달 */}
      <PairSetupModal
        isOpen={pairModalOpen}
        onClose={() => setPairModalOpen(false)}
        onSuccess={fetchPairs}
      />

      {/* 도움말 */}
      <p className="text-xs text-muted-foreground text-center mt-6">
        <span aria-hidden="true">💡</span> 정류소 상세 페이지에서 버스를 추적 대상으로 추가할 수
        있습니다.
      </p>
    </div>
  );
}
