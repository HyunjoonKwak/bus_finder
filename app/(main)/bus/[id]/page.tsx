'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { useSearchStore } from '@/lib/store';

const REFRESH_INTERVAL = 15; // 15초마다 새로고침

interface StationInfo {
  stationID: string;
  stationName: string;
  arsID?: string;
  idx: number;
  x?: string;
  y?: string;
}

interface BusPositionInfo {
  busStationSeq: number;
  plateNo?: string;
  lowPlate?: boolean;
  crowded?: number;
}

interface RouteInfo {
  routeId: string;
  routeName: string;
  startStation?: string;
  endStation?: string;
  firstTime?: string;
  lastTime?: string;
  interval?: number;
}

export default function BusDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { addRecentRoute } = useSearchStore();
  const busId = params.id as string;
  const busNo = searchParams.get('no') || '버스';

  const [stations, setStations] = useState<StationInfo[]>([]);
  const [busPositions, setBusPositions] = useState<BusPositionInfo[]>([]);
  const [busInfo, setBusInfo] = useState<RouteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const fetchBusDetail = useCallback(async () => {
    try {
      // 새 API 호출 (routeId와 busNo 전달)
      const apiParams = new URLSearchParams();
      apiParams.set('routeId', busId);
      if (busNo) apiParams.set('busNo', busNo);

      const response = await fetch(`/api/bus/route?${apiParams.toString()}`);
      const data = await response.json();

      setStations(data.stations || []);
      setBusPositions(data.realtime || []);
      if (data.routeInfo) {
        setBusInfo(data.routeInfo);
      }
    } catch (error) {
      console.error('Fetch bus detail error:', error);
    } finally {
      setLoading(false);
    }
  }, [busId, busNo]);

  // 카운트다운 리셋
  const resetCountdown = useCallback(() => {
    setCountdown(REFRESH_INTERVAL);
  }, []);

  // 수동 새로고침
  const handleManualRefresh = useCallback(() => {
    fetchBusDetail();
    resetCountdown();
  }, [fetchBusDetail, resetCountdown]);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        checkFavorite(user.id);
      }
    });

    // 최근 검색 이력에 저장
    addRecentRoute({
      busId,
      busNo,
    });

    fetchBusDetail();

    // 카운트다운 타이머 (1초마다)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchBusDetail();
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [busId, fetchBusDetail]);

  const checkFavorite = async (_userId: string) => {
    try {
      const response = await fetch(`/api/favorites/routes`);
      const data = await response.json();
      interface FavoriteRoute { bus_id: string; bus_no: string }
      const favorites: FavoriteRoute[] = data.routes || [];
      setIsFavorite(favorites.some((f) => f.bus_id === busId));
    } catch (error) {
      console.error('Check favorite error:', error);
    }
  };

  const toggleFavorite = async () => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    try {
      if (isFavorite) {
        await fetch(`/api/favorites/routes?busId=${busId}`, {
          method: 'DELETE',
        });
      } else {
        await fetch('/api/favorites/routes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bus_id: busId,
            bus_no: busNo,
          }),
        });
      }
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Toggle favorite error:', error);
    }
  };

  // 버스가 현재 위치한 정류장 인덱스 찾기
  const getBusAtStation = (stationIdx: number) => {
    return busPositions.find((bus) => bus.busStationSeq === stationIdx);
  };

  // 버스 없음 안내
  const noBusMessage = !loading && stations.length === 0;

  if (loading) {
    return (
      <div className="px-4 py-4">
        <div className="animate-pulse">
          <div className="h-8 w-32 bg-muted rounded mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 정류소 클릭 시 이동
  const handleStationClick = (stationId: string, stationName: string, arsId?: string) => {
    const params = new URLSearchParams();
    params.set('name', stationName);
    if (arsId) params.set('arsId', arsId);
    router.push(`/station/${stationId}?${params.toString()}`);
  };

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-primary">{busInfo?.routeName || busNo}</h1>
          {busInfo && busInfo.startStation && busInfo.endStation && (
            <p className="text-xs text-muted-foreground">
              {busInfo.startStation} → {busInfo.endStation}
            </p>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={toggleFavorite}
          className={isFavorite ? 'text-yellow-500 border-yellow-500' : ''}
        >
          {isFavorite ? '★ 즐겨찾기' : '☆ 즐겨찾기'}
        </Button>
      </div>

      {busInfo && (
        <div className="flex gap-4 text-xs text-muted-foreground mb-4">
          {busInfo.firstTime && <span>첫차: {busInfo.firstTime}</span>}
          {busInfo.lastTime && <span>막차: {busInfo.lastTime}</span>}
          {busInfo.interval && <span>배차: {busInfo.interval}분</span>}
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-foreground">
            경유 정류소 ({stations.length}개)
          </h2>
          <span className="text-xs text-muted-foreground">
            {countdown}초 후 갱신
          </span>
        </div>
        <div className="flex items-center gap-2">
          {busPositions.length > 0 && (
            <Badge className="bg-primary">
              운행 중 {busPositions.length}대
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleManualRefresh}
            className="text-xs gap-1"
          >
            <RefreshIcon className="w-3 h-3" />
            새로고침
          </Button>
        </div>
      </div>

      {/* 카운트다운 표시 (펄스 효과) */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative">
          <div className="w-2 h-2 bg-primary rounded-full animate-ping absolute" />
          <div className="w-2 h-2 bg-primary rounded-full" />
        </div>
        <div className="flex gap-0.5">
          {Array.from({ length: REFRESH_INTERVAL }).map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${
                i < countdown ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </div>

      {noBusMessage ? (
        <div className="text-center text-muted-foreground text-sm mt-4 space-y-2">
          <p>버스 노선 정보를 조회할 수 없습니다.</p>
          <p className="text-xs">버스 번호나 노선 ID가 올바른지 확인해 주세요.</p>
        </div>
      ) : (
        <div className="relative">
          {/* 노선 라인 */}
          <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-primary/20" />

          <div className="space-y-1">
            {stations.map((station, index) => {
              const busAtStation = getBusAtStation(station.idx);
              return (
                <Card
                  key={`${station.stationID}-${index}`}
                  onClick={() => handleStationClick(station.stationID, station.stationName, station.arsID)}
                  className={`p-3 pl-10 relative cursor-pointer hover:bg-accent/50 transition-colors ${
                    busAtStation ? 'bg-primary/10 border-primary/30' : ''
                  }`}
                >
                  {/* 정류장 마커 */}
                  <div
                    className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 ${
                      busAtStation
                        ? 'bg-primary border-primary'
                        : 'bg-background border-primary/40'
                    }`}
                  />

                  {/* 버스 아이콘 */}
                  {busAtStation && (
                    <div className="absolute left-7 top-1/2 -translate-y-1/2">
                      <span className="text-lg">🚌</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className={busAtStation ? 'pl-6' : ''}>
                      <p className="font-medium text-foreground text-sm hover:text-primary transition-colors">
                        {station.stationName}
                        <ChevronRightIcon className="w-4 h-4 inline-block ml-0.5 opacity-50" />
                      </p>
                      {station.arsID && (
                        <p className="text-xs text-muted-foreground">
                          {station.arsID}
                        </p>
                      )}
                      {/* 버스 상세 정보 (차량번호, 저상버스, 혼잡도) */}
                      {busAtStation && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {busAtStation.lowPlate && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                              저상
                            </span>
                          )}
                          {busAtStation.plateNo && (
                            <span className="text-[10px] text-muted-foreground">
                              {busAtStation.plateNo}
                            </span>
                          )}
                          {busAtStation.crowded !== undefined && busAtStation.crowded > 0 && (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              busAtStation.crowded === 1 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                              busAtStation.crowded === 2 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              busAtStation.crowded === 3 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                              'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            }`}>
                              {busAtStation.crowded === 1 ? '여유' :
                               busAtStation.crowded === 2 ? '보통' :
                               busAtStation.crowded === 3 ? '혼잡' : '매우혼잡'}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{index + 1}</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
