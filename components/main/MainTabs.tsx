'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { MyPlace, useSearchStore } from '@/lib/store';
import { getCurrentPosition } from '@/lib/kakao';

type TabType = 'favorites' | 'station' | 'route' | 'search';

interface FavoriteStation {
  id: string;
  station_id: string;
  station_name: string;
}

interface FavoriteRoute {
  id: string;
  bus_id: string;
  bus_no: string;
}

interface RouteHistoryItem {
  id: string;
  origin_name: string;
  origin_x: string;
  origin_y: string;
  dest_name: string;
  dest_x: string;
  dest_y: string;
  created_at: string;
}

interface ApiMyPlace {
  id: string;
  name: string;
  place_name: string;
  address: string | null;
  x: string;
  y: string;
  icon: 'home' | 'office' | 'pin';
  sort_order: number;
}

interface MainTabsProps {
  className?: string;
}

export function MainTabs({ className }: MainTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('favorites');
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Zustand store에서 최근 검색 이력 가져오기
  const { recentStations, recentRoutes } = useSearchStore();

  // 즐겨찾기 상태
  const [favoriteStations, setFavoriteStations] = useState<FavoriteStation[]>([]);
  const [favoriteRoutes, setFavoriteRoutes] = useState<FavoriteRoute[]>([]);
  const [myPlaces, setMyPlaces] = useState<MyPlace[]>([]);
  const [routeHistory, setRouteHistory] = useState<RouteHistoryItem[]>([]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchData();
      } else {
        setLoading(false);
      }
    });
  }, []);

  const fetchData = async () => {
    try {
      const [favStationsRes, favRoutesRes, myPlacesRes, routeHistoryRes] = await Promise.all([
        fetch('/api/favorites/stations'),
        fetch('/api/favorites/routes'),
        fetch('/api/my-places'),
        fetch('/api/route-history'),
      ]);

      const [favStationsData, favRoutesData, myPlacesData, routeHistoryData] = await Promise.all([
        favStationsRes.json(),
        favRoutesRes.json(),
        myPlacesRes.json(),
        routeHistoryRes.json(),
      ]);

      setFavoriteStations(favStationsData.stations || []);
      setFavoriteRoutes(favRoutesData.routes || []);
      setRouteHistory(routeHistoryData.history || []);

      // API 응답을 프론트엔드 타입으로 변환
      const places = (myPlacesData.places || []).map((p: ApiMyPlace) => ({
        id: p.id,
        name: p.name,
        placeName: p.place_name,
        address: p.address || undefined,
        x: p.x,
        y: p.y,
        icon: p.icon,
        sortOrder: p.sort_order,
      }));
      setMyPlaces(places);
    } catch (error) {
      console.error('Fetch data error:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'favorites' as TabType, label: '즐겨찾기', icon: '⭐' },
    { id: 'station' as TabType, label: '정류소', icon: '🚏' },
    { id: 'route' as TabType, label: '노선', icon: '🚌' },
    { id: 'search' as TabType, label: '길찾기', icon: '🗺️' },
  ];

  const getPlaceIcon = (icon: string) => {
    switch (icon) {
      case 'home':
        return '🏠';
      case 'office':
        return '🏢';
      default:
        return '📍';
    }
  };

  const handleMyPlaceClick = async (place: MyPlace) => {
    try {
      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // 현재 위치와 선택한 장소 사이의 거리 계산 (단순 좌표 차이)
      const destLat = parseFloat(place.y);
      const destLng = parseFloat(place.x);
      const distance = Math.sqrt(
        Math.pow(lat - destLat, 2) + Math.pow(lng - destLng, 2)
      );

      // 약 100m 이내면 (좌표 차이 약 0.001) 너무 가까움
      if (distance < 0.001) {
        alert('현재 위치와 도착지가 너무 가깝습니다.');
        return;
      }

      router.push(
        `/search?origin=${encodeURIComponent('현재 위치')}&sx=${lng}&sy=${lat}&dest=${encodeURIComponent(place.placeName)}&ex=${place.x}&ey=${place.y}`
      );
    } catch {
      router.push(`/search?dest=${encodeURIComponent(place.placeName)}&ex=${place.x}&ey=${place.y}`);
    }
  };

  return (
    <div className={cn('bg-background', className)}>
      {/* 탭 헤더 */}
      <div className="flex border-b border-border bg-background/95 backdrop-blur-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex-1 py-3 text-xs font-medium transition-colors relative flex flex-col items-center gap-0.5',
              activeTab === tab.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <span className="text-base">{tab.icon}</span>
            <span>{tab.label}</span>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="p-3 min-h-[200px] max-h-[calc(100dvh-16rem)] overflow-y-auto">
        {loading ? (
          <div className="py-8 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* 즐겨찾기 탭 */}
            {activeTab === 'favorites' && (
              <div className="space-y-4">
                {!user ? (
                  <Card className="p-4 border-border/50 bg-primary/5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-lg">👤</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">로그인하고 더 편리하게</p>
                        <p className="text-xs text-muted-foreground">즐겨찾기, 내 장소 등 이용</p>
                      </div>
                      <Link href="/login">
                        <Button size="sm">로그인</Button>
                      </Link>
                    </div>
                  </Card>
                ) : (
                  <>
                    {/* 내 장소 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xs font-medium text-muted-foreground">내 장소</h3>
                        <Link href="/my-places" className="text-xs text-primary hover:underline">
                          관리
                        </Link>
                      </div>
                      {myPlaces.length === 0 ? (
                        <Card className="p-3 border-dashed border-2 border-border/50">
                          <Link href="/my-places" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                            <span className="text-lg">+</span>
                            <span>집, 회사 등 자주 가는 장소 등록</span>
                          </Link>
                        </Card>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {myPlaces.map((place) => (
                            <Card
                              key={place.id}
                              className="px-3 py-2 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer select-none touch-manipulation"
                              onClick={() => handleMyPlaceClick(place)}
                            >
                              <div className="flex items-center gap-2">
                                <span>{getPlaceIcon(place.icon)}</span>
                                <span className="text-sm font-medium">{place.name}</span>
                              </div>
                            </Card>
                          ))}
                          {myPlaces.length < 5 && (
                            <Link href="/my-places">
                              <Card className="px-3 py-2 border-dashed border-2 border-border/50 hover:bg-accent/50 transition-colors">
                                <span className="text-sm text-muted-foreground">+ 추가</span>
                              </Card>
                            </Link>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 즐겨찾기 정류소 */}
                    {favoriteStations.length > 0 && (
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground mb-2">정류소</h3>
                        <div className="grid grid-cols-2 gap-2">
                          {favoriteStations.slice(0, 4).map((station) => (
                            <Card
                              key={station.id}
                              className="p-2.5 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer select-none touch-manipulation"
                              onClick={() => router.push(`/station/${station.station_id}?name=${encodeURIComponent(station.station_name)}`)}
                            >
                              <p className="text-sm font-medium truncate">{station.station_name}</p>
                            </Card>
                          ))}
                        </div>
                        {favoriteStations.length > 4 && (
                          <Link href="/bus" className="block text-center text-xs text-primary mt-2 hover:underline">
                            더보기 ({favoriteStations.length}개)
                          </Link>
                        )}
                      </div>
                    )}

                    {/* 즐겨찾기 노선 */}
                    {favoriteRoutes.length > 0 && (
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground mb-2">노선</h3>
                        <div className="flex flex-wrap gap-2">
                          {favoriteRoutes.slice(0, 6).map((route) => (
                            <Card
                              key={route.id}
                              className="px-3 py-1.5 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer select-none touch-manipulation"
                              onClick={() => router.push(`/bus/${route.bus_id}?no=${encodeURIComponent(route.bus_no)}`)}
                            >
                              <span className="font-bold text-sm text-primary">{route.bus_no}</span>
                            </Card>
                          ))}
                        </div>
                      </div>
                    )}

                    {favoriteStations.length === 0 && favoriteRoutes.length === 0 && myPlaces.length === 0 && (
                      <div className="py-6 text-center">
                        <p className="text-sm text-muted-foreground">즐겨찾기가 없습니다</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">정류소나 노선을 즐겨찾기에 추가해보세요</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* 정류소 탭 */}
            {activeTab === 'station' && (
              <div className="space-y-3">
                <Link href="/bus">
                  <Card className="p-3 border-border/50 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🚏</span>
                      <div>
                        <p className="text-sm font-medium">정류소 검색 · 주변 정류소</p>
                        <p className="text-xs text-muted-foreground">정류소 검색 및 주변 정류소 찾기</p>
                      </div>
                    </div>
                  </Card>
                </Link>

                {/* 즐겨찾기 정류소 */}
                {user && favoriteStations.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-2">즐겨찾기 정류소</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {favoriteStations.map((station) => (
                        <Card
                          key={station.id}
                          className="p-2.5 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer select-none touch-manipulation"
                          onClick={() => router.push(`/station/${station.station_id}?name=${encodeURIComponent(station.station_name)}`)}
                        >
                          <p className="text-sm font-medium truncate">{station.station_name}</p>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* 최근 검색 정류소 */}
                {recentStations.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-2">최근 검색</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {recentStations.slice(0, 6).map((station) => (
                        <Card
                          key={station.stationId}
                          className="p-2.5 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer select-none touch-manipulation"
                          onClick={() => router.push(`/station/${station.stationId}?name=${encodeURIComponent(station.stationName)}${station.arsId ? `&arsId=${station.arsId}` : ''}`)}
                        >
                          <p className="text-sm font-medium truncate">{station.stationName}</p>
                          {station.arsId && (
                            <p className="text-xs text-muted-foreground">{station.arsId}</p>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* 비로그인 안내 */}
                {!user && favoriteStations.length === 0 && recentStations.length === 0 && (
                  <Card className="p-3 border-border/50 bg-muted/30">
                    <p className="text-xs text-muted-foreground text-center">
                      로그인하면 즐겨찾기 정류소를 볼 수 있어요
                    </p>
                  </Card>
                )}
              </div>
            )}

            {/* 노선 탭 */}
            {activeTab === 'route' && (
              <div className="space-y-3">
                <Link href="/bus?tab=route">
                  <Card className="p-3 border-border/50 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🚌</span>
                      <div>
                        <p className="text-sm font-medium">노선 검색</p>
                        <p className="text-xs text-muted-foreground">버스 번호로 검색</p>
                      </div>
                    </div>
                  </Card>
                </Link>
                {user && favoriteRoutes.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-2">즐겨찾기 노선</h3>
                    <div className="flex flex-wrap gap-2">
                      {favoriteRoutes.map((route) => (
                        <Card
                          key={route.id}
                          className="px-3 py-1.5 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer select-none touch-manipulation"
                          onClick={() => router.push(`/bus/${route.bus_id}?no=${encodeURIComponent(route.bus_no)}`)}
                        >
                          <span className="font-bold text-sm text-primary">{route.bus_no}</span>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* 최근 검색 노선 */}
                {recentRoutes.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-2">최근 검색</h3>
                    <div className="flex flex-wrap gap-2">
                      {recentRoutes.slice(0, 8).map((route) => (
                        <Card
                          key={route.busId}
                          className="px-3 py-1.5 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer select-none touch-manipulation"
                          onClick={() => router.push(`/bus/${route.busId}?no=${encodeURIComponent(route.busNo)}`)}
                        >
                          <span className="font-bold text-sm">{route.busNo}</span>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 길찾기 탭 */}
            {activeTab === 'search' && (
              <div className="space-y-3">
                <Link href="/search">
                  <Card className="p-3 border-border/50 hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🗺️</span>
                      <div>
                        <p className="text-sm font-medium">경로 검색</p>
                        <p className="text-xs text-muted-foreground">출발지 → 도착지 대중교통 안내</p>
                      </div>
                    </div>
                  </Card>
                </Link>

                {/* 내 장소로 빠르게 */}
                {user && myPlaces.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-2">내 장소로 빠르게</h3>
                    <div className="space-y-2">
                      {myPlaces.slice(0, 3).map((place) => (
                        <Card
                          key={place.id}
                          className="p-2.5 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer select-none touch-manipulation"
                          onClick={() => handleMyPlaceClick(place)}
                        >
                          <div className="flex items-center gap-2">
                            <span>{getPlaceIcon(place.icon)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{place.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{place.placeName}</p>
                            </div>
                            <span className="text-xs text-primary">길찾기</span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* 최근 길찾기 */}
                {user && routeHistory.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-2">최근 길찾기</h3>
                    <div className="space-y-2">
                      {routeHistory.slice(0, 5).map((history) => (
                        <Card
                          key={history.id}
                          className="p-2.5 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer select-none touch-manipulation"
                          onClick={() => router.push(`/search?origin=${encodeURIComponent(history.origin_name)}&dest=${encodeURIComponent(history.dest_name)}&sx=${history.origin_x}&sy=${history.origin_y}&ex=${history.dest_x}&ey=${history.dest_y}`)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🗺️</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{history.origin_name}</p>
                              <p className="text-xs text-muted-foreground truncate">→ {history.dest_name}</p>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* 비로그인 안내 */}
                {!user && (
                  <Card className="p-3 border-border/50 bg-muted/30">
                    <p className="text-xs text-muted-foreground text-center">
                      로그인하면 최근 길찾기 이력을 볼 수 있어요
                    </p>
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
