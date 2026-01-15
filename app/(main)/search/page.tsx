'use client';

import { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { SearchForm } from '@/components/search/SearchForm';
import { cn } from '@/lib/utils';
import { useSearchStore } from '@/lib/store';
import { loadKakaoMapScript, getCurrentPosition } from '@/lib/kakao';

interface Coordinate {
  x: number;
  y: number;
}

interface RouteLeg {
  mode: string;
  duration: number;
  routeName?: string;
  routeId?: string;
  startName: string;
  endName: string;
  stationCount?: number;
  distance?: number;
  start?: Coordinate;
  end?: Coordinate;
  passCoords?: Coordinate[];
}

interface RouteResult {
  id: string;
  origin: { name: string; x?: number; y?: number };
  destination: { name: string; x?: number; y?: number };
  totalTime: number;
  totalDistance?: number;
  walkTime: number;
  transferCount: number;
  fare: number;
  legs: RouteLeg[];
  pathType?: number;
}

interface SearchResponse {
  routes: RouteResult[];
  matchedOrigin?: string;
  matchedDest?: string;
  error?: string;
}

type TabType = 'search' | 'recent';

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { recentSearches } = useSearchStore();
  const origin = searchParams.get('origin');
  const dest = searchParams.get('dest');

  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeOverlaysRef = useRef<any[]>([]); // 경로 오버레이들 (polylines, markers)

  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [matchedPlaces, setMatchedPlaces] = useState<{ origin?: string; dest?: string }>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteResult | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);

  // 지도 초기화
  useEffect(() => {
    async function initMap() {
      try {
        await loadKakaoMapScript();

        let lat = 37.5665;
        let lng = 126.978;

        try {
          const position = await getCurrentPosition();
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        } catch {
          console.log('현재 위치를 가져올 수 없습니다.');
        }

        setCurrentLocation({ lat, lng });

        if (!mapRef.current) return;

        const kakao = window.kakao;
        const map = new kakao.maps.Map(mapRef.current, {
          center: new kakao.maps.LatLng(lat, lng),
          level: 7,
        });
        mapInstanceRef.current = map;

        // 줌 컨트롤 추가 (우측)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const zoomControl = new (kakao.maps as any).ZoomControl();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (map as any).addControl(zoomControl, (kakao.maps as any).ControlPosition.RIGHT);

        // 지도 타입 컨트롤 추가 (우측 상단)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapTypeControl = new (kakao.maps as any).MapTypeControl();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (map as any).addControl(mapTypeControl, (kakao.maps as any).ControlPosition.TOPRIGHT);

        // 현재 위치 마커
        const markerContent = `
          <div style="position: relative;">
            <div style="width: 16px; height: 16px; background: #3B82F6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
          </div>
        `;
        new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(lat, lng),
          content: markerContent,
          map: map,
        });

        setMapLoaded(true);
      } catch (err) {
        console.error('Map init error:', err);
      }
    }

    initMap();
  }, []);

  // 선택된 경로를 지도에 표시
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || !selectedRoute) return;

    const kakao = window.kakao;

    // 기존 오버레이 제거
    routeOverlaysRef.current.forEach(overlay => {
      overlay.setMap(null);
    });
    routeOverlaysRef.current = [];

    const bounds = new kakao.maps.LatLngBounds();
    const colors = {
      walk: '#9CA3AF', // gray
      bus: '#3B82F6',  // blue
      subway: '#22C55E', // green
    };

    // 출발지 마커
    if (selectedRoute.origin.x && selectedRoute.origin.y) {
      const originPos = new kakao.maps.LatLng(selectedRoute.origin.y, selectedRoute.origin.x);
      bounds.extend(originPos);

      const originMarker = new kakao.maps.CustomOverlay({
        position: originPos,
        content: `
          <div style="position: relative; transform: translate(-50%, -100%);">
            <div style="background: #3B82F6; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
              출발
            </div>
            <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid #3B82F6; margin: 0 auto;"></div>
          </div>
        `,
        map: mapInstanceRef.current,
        zIndex: 10,
      });
      routeOverlaysRef.current.push(originMarker);
    }

    // 도착지 마커
    if (selectedRoute.destination.x && selectedRoute.destination.y) {
      const destPos = new kakao.maps.LatLng(selectedRoute.destination.y, selectedRoute.destination.x);
      bounds.extend(destPos);

      const destMarker = new kakao.maps.CustomOverlay({
        position: destPos,
        content: `
          <div style="position: relative; transform: translate(-50%, -100%);">
            <div style="background: #EF4444; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; white-space: nowrap; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
              도착
            </div>
            <div style="width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 6px solid #EF4444; margin: 0 auto;"></div>
          </div>
        `,
        map: mapInstanceRef.current,
        zIndex: 10,
      });
      routeOverlaysRef.current.push(destMarker);
    }

    // 각 leg별 경로 그리기
    selectedRoute.legs.forEach((leg) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const path: any[] = [];

      // 시작점 추가
      if (leg.start) {
        path.push(new kakao.maps.LatLng(leg.start.y, leg.start.x));
        bounds.extend(path[path.length - 1]);
      }

      // 경유 좌표 추가
      if (leg.passCoords && leg.passCoords.length > 0) {
        leg.passCoords.forEach(coord => {
          path.push(new kakao.maps.LatLng(coord.y, coord.x));
          bounds.extend(path[path.length - 1]);
        });
      }

      // 끝점 추가
      if (leg.end) {
        path.push(new kakao.maps.LatLng(leg.end.y, leg.end.x));
        bounds.extend(path[path.length - 1]);
      }

      if (path.length >= 2) {
        const color = colors[leg.mode as keyof typeof colors] || colors.walk;
        const polyline = new kakao.maps.Polyline({
          path,
          strokeWeight: leg.mode === 'walk' ? 3 : 5,
          strokeColor: color,
          strokeOpacity: leg.mode === 'walk' ? 0.6 : 0.8,
          strokeStyle: leg.mode === 'walk' ? 'shortdash' : 'solid',
        });
        polyline.setMap(mapInstanceRef.current);
        routeOverlaysRef.current.push(polyline);
      }
    });

    // 지도 범위 조정
    // bounds가 유효한지 체크
    try {
      mapInstanceRef.current.setBounds(bounds, 50);
    } catch {
      // bounds가 비어있으면 무시
    }
  }, [selectedRoute, mapLoaded]);

  // 경로 검색
  useEffect(() => {
    if (!origin || !dest) return;

    const fetchRoutes = async () => {
      setLoading(true);
      setError(null);

      try {
        const sx = searchParams.get('sx');
        const sy = searchParams.get('sy');
        const ex = searchParams.get('ex');
        const ey = searchParams.get('ey');

        let url = `/api/search?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(dest)}`;
        if (sx && sy) url += `&sx=${sx}&sy=${sy}`;
        if (ex && ey) url += `&ex=${ex}&ey=${ey}`;

        const response = await fetch(url);
        const data: SearchResponse = await response.json();

        if (!response.ok) {
          setError(data.error || '경로 검색에 실패했습니다.');
          return;
        }

        setRoutes(data.routes || []);
        setMatchedPlaces({
          origin: data.matchedOrigin,
          dest: data.matchedDest,
        });

        if (data.routes && data.routes.length > 0) {
          setSelectedRoute(data.routes[0]);
        }
      } catch (err) {
        setError('경로 검색 중 오류가 발생했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRoutes();
  }, [origin, dest, searchParams]);

  const handleRecentSearch = (search: { origin: string; destination: string }) => {
    router.push(`/search?origin=${encodeURIComponent(search.origin)}&dest=${encodeURIComponent(search.destination)}`);
  };

  const handleRouteSelect = (route: RouteResult) => {
    setSelectedRoute(route);
  };

  const moveToCurrentLocation = () => {
    if (!mapInstanceRef.current || !currentLocation) return;
    const kakao = window.kakao;
    mapInstanceRef.current.setCenter(new kakao.maps.LatLng(currentLocation.lat, currentLocation.lng));
    mapInstanceRef.current.setLevel(5);
  };

  const tabs = [
    { id: 'search' as TabType, label: '검색', icon: '🔍' },
    { id: 'recent' as TabType, label: '최근', icon: '🕐' },
  ];

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-3rem)] overflow-hidden">
      {/* 사이드 패널 - 모바일에서는 하단에서 올라오는 시트 형태 */}
      <div
        className={cn(
          "bg-background flex flex-col transition-all duration-300",
          // 모바일: 하단 시트 스타일
          "fixed md:relative inset-x-0 bottom-0 md:inset-auto z-20 md:z-auto",
          "rounded-t-2xl md:rounded-none border-t md:border-t-0 md:border-r border-border",
          "shadow-[0_-4px_20px_rgba(0,0,0,0.1)] md:shadow-none",
          // 패널 너비/높이
          isPanelOpen
            ? "h-[50vh] md:h-auto md:w-96 md:flex-shrink-0"
            : "h-0 md:h-auto md:w-0"
        )}
      >
        {/* 모바일 드래그 핸들 */}
        <div className="md:hidden flex justify-center py-1">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* 탭 헤더 */}
        <div className="flex-shrink-0 px-2 pb-2 md:p-3 border-b border-border bg-muted/30">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 py-1.5 px-2 md:py-2 md:px-3 rounded-lg text-xs md:text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-muted-foreground"
                )}
              >
                <span className="mr-0.5 md:mr-1">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 탭 내용 */}
        <div className="flex-1 overflow-y-auto">
          {/* 검색 탭 */}
          {activeTab === 'search' && (
            <div className="p-4">
              <SearchForm />

              {/* 검색 결과 */}
              {origin && dest && (
                <div className="mt-4">
                  {/* 출발/도착 표시 */}
                  <div className="p-3 bg-muted/50 rounded-lg mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-sm truncate">{matchedPlaces.origin || origin}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm truncate">{matchedPlaces.dest || dest}</span>
                    </div>
                  </div>

                  {/* 로딩 */}
                  {loading && (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-muted-foreground">경로 검색 중...</span>
                      </div>
                    </div>
                  )}

                  {/* 에러 */}
                  {error && !loading && (
                    <div className="text-center py-8">
                      <p className="text-destructive text-sm mb-1">{error}</p>
                      <p className="text-xs text-muted-foreground">더 정확한 장소명을 입력해보세요</p>
                    </div>
                  )}

                  {/* 경로 목록 */}
                  {!loading && !error && routes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground mb-2">{routes.length}개의 경로</p>
                      {routes.map((route, index) => (
                        <button
                          key={route.id}
                          onClick={() => handleRouteSelect(route)}
                          className={cn(
                            "w-full p-3 text-left rounded-lg border border-border hover:bg-accent/50 transition-colors",
                            selectedRoute?.id === route.id && "bg-accent border-primary"
                          )}
                        >
                          {index === 0 && (
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-amber-500 text-white text-xs">추천</Badge>
                              <PathTypeBadge pathType={route.pathType} />
                            </div>
                          )}

                          <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-xl font-bold">{route.totalTime}</span>
                            <span className="text-sm text-muted-foreground">분</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              환승 {route.transferCount}회
                            </span>
                          </div>

                          <div className="flex items-center gap-1 mb-2 flex-wrap">
                            {route.legs.map((leg, legIndex) => (
                              <div key={legIndex} className="flex items-center gap-1">
                                {leg.mode === 'walk' ? (
                                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                    <WalkIcon className="h-3 w-3" />
                                    {leg.duration}분
                                  </span>
                                ) : (
                                  <span
                                    className={cn(
                                      "px-1.5 py-0.5 rounded text-xs font-medium text-white",
                                      leg.mode === 'bus' && "bg-blue-500",
                                      leg.mode === 'subway' && "bg-green-500"
                                    )}
                                  >
                                    {leg.routeName}
                                  </span>
                                )}
                                {legIndex < route.legs.length - 1 && (
                                  <svg className="h-3 w-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{(route.fare || 0).toLocaleString()}원</span>
                            {route.totalDistance && (
                              <span>{(route.totalDistance / 1000).toFixed(1)}km</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {!loading && !error && routes.length === 0 && origin && dest && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground text-sm">검색 결과가 없습니다</p>
                    </div>
                  )}
                </div>
              )}

              {/* 검색 전 안내 */}
              {!origin && !dest && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    출발지와 도착지를 입력하여<br />경로를 검색하세요
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 최근 검색 탭 */}
          {activeTab === 'recent' && (
            <div>
              {recentSearches.length > 0 ? (
                <>
                  <div className="p-3 bg-muted/50 border-b border-border sticky top-0">
                    <span className="text-sm text-muted-foreground">
                      최근 검색 {recentSearches.length}개
                    </span>
                  </div>
                  <div>
                    {recentSearches.slice(0, 20).map((search, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleRecentSearch(search)}
                        className="w-full p-4 text-left border-b border-border hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center text-sm">
                              <span className="truncate font-medium">{search.origin}</span>
                              <svg className="mx-2 h-3 w-3 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                              </svg>
                              <span className="truncate">{search.destination}</span>
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-muted-foreground text-sm">최근 검색 기록이 없습니다</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 선택된 경로 상세 */}
        {selectedRoute && (
          <div className="flex-shrink-0 p-4 border-t border-border bg-muted/30 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{selectedRoute.totalTime}분</span>
                <PathTypeBadge pathType={selectedRoute.pathType} />
              </div>
              <button
                onClick={() => setSelectedRoute(null)}
                className="p-1 hover:bg-accent rounded"
              >
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <RouteTimeline legs={selectedRoute.legs} />
          </div>
        )}
      </div>

      {/* 지도 영역 */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />

        {/* 패널 토글 버튼 */}
        <button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className="absolute top-4 left-4 z-10 bg-white p-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
        >
          <svg
            className={cn("w-5 h-5 text-gray-600 transition-transform", !isPanelOpen && "rotate-180")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 현재 위치 버튼 */}
        <button
          onClick={moveToCurrentLocation}
          className="absolute bottom-4 left-4 z-10 w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>

        {/* 지도 로딩 */}
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">지도 로딩 중...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RouteTimeline({ legs }: { legs: RouteLeg[] }) {
  return (
    <div className="relative">
      {legs.map((leg, index) => (
        <div key={index} className="flex gap-3 pb-3 last:pb-0">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-white",
                leg.mode === 'walk' && "bg-gray-400",
                leg.mode === 'bus' && "bg-blue-500",
                leg.mode === 'subway' && "bg-green-500"
              )}
            >
              {leg.mode === 'walk' && <WalkIcon className="h-3.5 w-3.5" />}
              {leg.mode === 'bus' && <BusIcon className="h-3.5 w-3.5" />}
              {leg.mode === 'subway' && <SubwayIcon className="h-3.5 w-3.5" />}
            </div>
            {index < legs.length - 1 && (
              <div className="w-0.5 flex-1 bg-gray-200 my-1" />
            )}
          </div>

          <div className="flex-1 pb-2">
            {leg.mode === 'walk' ? (
              <div>
                <p className="text-sm text-muted-foreground">
                  도보 {leg.duration}분
                  {leg.distance && <span className="ml-1">({leg.distance}m)</span>}
                </p>
                <p className="text-xs text-muted-foreground/70">{leg.startName} → {leg.endName}</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-xs font-bold text-white",
                      leg.mode === 'bus' && "bg-blue-500",
                      leg.mode === 'subway' && "bg-green-500"
                    )}
                  >
                    {leg.routeName}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {leg.duration}분
                    {leg.stationCount && <span className="ml-1">({leg.stationCount}정거장)</span>}
                  </span>
                </div>
                <p className="text-sm font-medium">{leg.startName}</p>
                <p className="text-xs text-muted-foreground/70">→ {leg.endName}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PathTypeBadge({ pathType }: { pathType?: number }) {
  switch (pathType) {
    case 1:
      return <Badge className="bg-green-500 text-white text-xs">지하철</Badge>;
    case 2:
      return <Badge className="bg-blue-500 text-white text-xs">버스</Badge>;
    case 3:
      return <Badge className="bg-purple-500 text-white text-xs">버스+지하철</Badge>;
    default:
      return null;
  }
}

function WalkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" />
    </svg>
  );
}

function BusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z" />
    </svg>
  );
}

function SubwayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2c-4.42 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm2 0V6h5v5h-5zm3.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
    </svg>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchLoading />}>
      <SearchContent />
    </Suspense>
  );
}

function SearchLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="w-96 bg-background border-r border-border p-4">
        <div className="animate-pulse space-y-4">
          <div className="flex gap-1">
            <div className="flex-1 h-10 bg-muted rounded-lg" />
            <div className="flex-1 h-10 bg-muted rounded-lg" />
          </div>
          <div className="h-10 bg-muted rounded" />
          <div className="h-10 bg-muted rounded" />
        </div>
      </div>
      <div className="flex-1 bg-muted" />
    </div>
  );
}
