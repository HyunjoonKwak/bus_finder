'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useSearchStore, MyPlace } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import { getCurrentPosition } from '@/lib/kakao';

type TabType = 'recent' | 'places' | 'transit' | 'route';

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

interface RouteHistoryItem {
  id: string;
  origin_name: string;
  origin_address: string | null;
  origin_x: string;
  origin_y: string;
  dest_name: string;
  dest_address: string | null;
  dest_x: string;
  dest_y: string;
  created_at: string;
}

interface SearchResult {
  id: string;
  name: string;
  address?: string;
  category?: string;
  x: string;
  y: string;
  type: 'place' | 'station' | 'route';
}

interface FavoriteStation {
  stationId: string;
  stationName: string;
  arsId?: string;
}

interface FavoriteRoute {
  busId: string;
  busNo: string;
  routeType?: string;
  startStationName?: string;
  endStationName?: string;
}

export default function SearchUnifiedPage() {
  const router = useRouter();
  const { recentSearches, removeRecentSearch, clearSearches } = useSearchStore();

  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('recent');
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [myPlaces, setMyPlaces] = useState<MyPlace[]>([]);
  const [routeHistory, setRouteHistory] = useState<RouteHistoryItem[]>([]);
  const [favoriteStations, setFavoriteStations] = useState<FavoriteStation[]>([]);
  const [favoriteRoutes, setFavoriteRoutes] = useState<FavoriteRoute[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchMyPlaces();
        fetchRouteHistory();
        fetchFavorites();
      }
    });
  }, []);

  const fetchFavorites = async () => {
    try {
      const [stationsRes, routesRes] = await Promise.all([
        fetch('/api/favorites/stations'),
        fetch('/api/favorites/routes'),
      ]);
      const stationsData = await stationsRes.json();
      const routesData = await routesRes.json();
      setFavoriteStations(stationsData.favorites || []);
      setFavoriteRoutes(routesData.favorites || []);
    } catch (error) {
      console.error('Fetch favorites error:', error);
    }
  };

  const fetchRouteHistory = async () => {
    try {
      const res = await fetch('/api/route-history');
      const data = await res.json();
      setRouteHistory(data.history || []);
    } catch (error) {
      console.error('Fetch route history error:', error);
    }
  };

  const deleteRouteHistory = async (id: string) => {
    try {
      await fetch(`/api/route-history/${id}`, { method: 'DELETE' });
      setRouteHistory((prev) => prev.filter((h) => h.id !== id));
    } catch (error) {
      console.error('Delete route history error:', error);
    }
  };

  const fetchMyPlaces = async () => {
    try {
      const res = await fetch('/api/my-places');
      const data = await res.json();
      const places = (data.places || []).map((p: ApiMyPlace) => ({
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
      console.error('Fetch my places error:', error);
    }
  };

  // 통합 검색
  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    try {
      // 장소 검색
      const placeRes = await fetch(`/api/places?query=${encodeURIComponent(searchQuery)}`);
      const placeData = await placeRes.json();

      // 정류소 검색
      const stationRes = await fetch(`/api/bus/station/search?query=${encodeURIComponent(searchQuery)}`);
      const stationData = await stationRes.json();

      // 노선 검색
      const routeRes = await fetch(`/api/bus/search?query=${encodeURIComponent(searchQuery)}`);
      const routeData = await routeRes.json();

      const results: SearchResult[] = [];

      // 장소 결과
      if (placeData.places) {
        placeData.places.slice(0, 5).forEach((p: { id: string; name: string; roadAddress?: string; address?: string; category?: string; x: string; y: string }) => {
          results.push({
            id: `place-${p.id}`,
            name: p.name,
            address: p.roadAddress || p.address,
            category: p.category,
            x: p.x,
            y: p.y,
            type: 'place',
          });
        });
      }

      // 정류소 결과
      if (stationData.stations) {
        stationData.stations.slice(0, 5).forEach((s: { stationId: string; stationName: string; x?: string; y?: string }) => {
          results.push({
            id: `station-${s.stationId}`,
            name: s.stationName,
            category: '정류소',
            x: s.x || '',
            y: s.y || '',
            type: 'station',
          });
        });
      }

      // 노선 결과
      if (routeData.buses) {
        routeData.buses.slice(0, 5).forEach((b: { busId: string; busNo: string; startStationName?: string; endStationName?: string }) => {
          results.push({
            id: `route-${b.busId}`,
            name: b.busNo,
            address: b.startStationName && b.endStationName ? `${b.startStationName} → ${b.endStationName}` : undefined,
            category: '버스노선',
            x: '',
            y: '',
            type: 'route',
          });
        });
      }

      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (query.length >= 2) {
        handleSearch(query);
        setActiveTab('transit');
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [query, handleSearch]);

  const handleBack = () => {
    router.back();
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'station') {
      const stationId = result.id.replace('station-', '');
      router.push(`/station/${stationId}?name=${encodeURIComponent(result.name)}`);
    } else if (result.type === 'route') {
      const busId = result.id.replace('route-', '');
      router.push(`/bus/${busId}?no=${encodeURIComponent(result.name)}`);
    } else {
      // 장소 선택 시 길찾기 도착지로 설정
      router.push(`/search?dest=${encodeURIComponent(result.name)}&ex=${result.x}&ey=${result.y}`);
    }
  };

  const handleRecentSearch = (search: { origin: string; destination: string; sx?: string; sy?: string; ex?: string; ey?: string }) => {
    let url = `/search?origin=${encodeURIComponent(search.origin)}&dest=${encodeURIComponent(search.destination)}`;
    if (search.sx && search.sy) url += `&sx=${search.sx}&sy=${search.sy}`;
    if (search.ex && search.ey) url += `&ex=${search.ex}&ey=${search.ey}`;
    router.push(url);
  };

  const handleMyPlaceClick = async (place: MyPlace) => {
    try {
      // 현재 위치 가져오기
      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // 현재 위치와 함께 길찾기 페이지로 이동
      router.push(
        `/search?origin=${encodeURIComponent('현재 위치')}&sx=${lng}&sy=${lat}&dest=${encodeURIComponent(place.placeName)}&ex=${place.x}&ey=${place.y}`
      );
    } catch {
      // 위치 권한이 없는 경우 도착지만 설정
      router.push(`/search?dest=${encodeURIComponent(place.placeName)}&ex=${place.x}&ey=${place.y}`);
    }
  };

  const handleRouteHistoryClick = (history: RouteHistoryItem) => {
    const url = `/search?origin=${encodeURIComponent(history.origin_name)}&dest=${encodeURIComponent(history.dest_name)}&sx=${history.origin_x}&sy=${history.origin_y}&ex=${history.dest_x}&ey=${history.dest_y}`;
    router.push(url);
  };

  const handleFavoriteStationClick = (station: FavoriteStation) => {
    router.push(`/station/${station.stationId}?name=${encodeURIComponent(station.stationName)}`);
  };

  const handleFavoriteRouteClick = (route: FavoriteRoute) => {
    router.push(`/bus/${route.busId}?no=${encodeURIComponent(route.busNo)}`);
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  const getPlaceIcon = (icon: string) => {
    switch (icon) {
      case 'home': return '🏠';
      case 'office': return '🏢';
      default: return '📍';
    }
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'station': return '🚏';
      case 'route': return '🚌';
      default: return '📍';
    }
  };

  const tabs = [
    { id: 'recent' as TabType, label: '최근' },
    { id: 'places' as TabType, label: '장소' },
    { id: 'transit' as TabType, label: '대중교통' },
    { id: 'route' as TabType, label: '경로' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* 검색 헤더 */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center gap-2 p-3">
          <button onClick={handleBack} className="p-2 hover:bg-accent rounded-full transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="장소, 버스, 정류소 검색"
              className="w-full px-4 py-2.5 bg-muted rounded-full text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-accent rounded-full"
              >
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button onClick={handleBack} className="text-sm text-muted-foreground hover:text-foreground px-2">
            취소
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-border/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 py-2.5 text-sm font-medium transition-colors relative',
                activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="p-3">
        {/* 검색 결과 (검색어가 있을 때) */}
        {query.length >= 2 && activeTab === 'transit' && (
          <div>
            {loading ? (
              <div className="py-8 flex justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">검색 결과가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-1">
                {searchResults.map((result) => (
                  <Card
                    key={result.id}
                    className="p-3 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => handleResultClick(result)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getResultIcon(result.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{result.name}</p>
                        {result.address && (
                          <p className="text-xs text-muted-foreground truncate">{result.address}</p>
                        )}
                      </div>
                      {result.category && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {result.category}
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 최근 탭 - 모든 항목 통합 표시 */}
        {activeTab === 'recent' && !query && (
          <div className="space-y-4">
            {/* 내 장소 */}
            {myPlaces.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-2">내 장소</h3>
                <div className="space-y-1">
                  {myPlaces.slice(0, 3).map((place) => (
                    <Card
                      key={`place-${place.id}`}
                      className="p-3 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => handleMyPlaceClick(place)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{getPlaceIcon(place.icon)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{place.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{place.placeName}</p>
                        </div>
                        <span className="text-xs text-primary">길찾기</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* 즐겨찾기 정류소 */}
            {favoriteStations.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-2">즐겨찾기 정류소</h3>
                <div className="space-y-1">
                  {favoriteStations.slice(0, 3).map((station) => (
                    <Card
                      key={`station-${station.stationId}`}
                      className="p-3 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => handleFavoriteStationClick(station)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🚏</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{station.stationName}</p>
                          {station.arsId && (
                            <p className="text-xs text-muted-foreground">{station.arsId}</p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* 즐겨찾기 노선 */}
            {favoriteRoutes.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-2">즐겨찾기 노선</h3>
                <div className="space-y-1">
                  {favoriteRoutes.slice(0, 3).map((route) => (
                    <Card
                      key={`route-${route.busId}`}
                      className="p-3 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => handleFavoriteRouteClick(route)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🚌</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{route.busNo}</p>
                          {route.startStationName && route.endStationName && (
                            <p className="text-xs text-muted-foreground truncate">
                              {route.startStationName} → {route.endStationName}
                            </p>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* 최근 길찾기 이력 (DB) */}
            {routeHistory.length > 0 && (
              <div>
                <h3 className="text-xs font-medium text-muted-foreground mb-2">최근 길찾기</h3>
                <div className="space-y-1">
                  {routeHistory.slice(0, 5).map((history) => (
                    <Card
                      key={`history-${history.id}`}
                      className="p-3 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => handleRouteHistoryClick(history)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🗺️</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{history.origin_name}</p>
                          <p className="text-xs text-muted-foreground truncate">→ {history.dest_name}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {formatTimeAgo(history.created_at)}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* 아무 데이터도 없을 때 */}
            {myPlaces.length === 0 && favoriteStations.length === 0 && favoriteRoutes.length === 0 && routeHistory.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">최근 기록이 없습니다</p>
                <p className="text-xs text-muted-foreground/70 mt-1">장소, 정류소, 노선을 검색하거나 즐겨찾기해보세요</p>
              </div>
            )}
          </div>
        )}

        {/* 장소 탭 */}
        {activeTab === 'places' && !query && (
          <div>
            {!user ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground mb-2">로그인하면 내 장소를 저장할 수 있어요</p>
                <button
                  onClick={() => router.push('/login')}
                  className="text-sm text-primary hover:underline"
                >
                  로그인하기
                </button>
              </div>
            ) : myPlaces.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground mb-2">등록된 장소가 없습니다</p>
                <button
                  onClick={() => router.push('/my-places')}
                  className="text-sm text-primary hover:underline"
                >
                  내 장소 추가하기
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {myPlaces.map((place) => (
                  <Card
                    key={place.id}
                    className="p-3 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => handleMyPlaceClick(place)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getPlaceIcon(place.icon)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{place.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{place.placeName}</p>
                      </div>
                      <span className="text-xs text-primary">길찾기</span>
                    </div>
                  </Card>
                ))}
                <button
                  onClick={() => router.push('/my-places')}
                  className="w-full p-3 border-2 border-dashed border-border/50 rounded-lg text-sm text-muted-foreground hover:bg-accent/50 transition-colors"
                >
                  + 내 장소 추가
                </button>
              </div>
            )}
          </div>
        )}

        {/* 대중교통 탭 (검색어 없을 때 즐겨찾기 표시) */}
        {activeTab === 'transit' && !query && (
          <div className="space-y-4">
            {!user ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground mb-2">로그인하면 즐겨찾기를 저장할 수 있어요</p>
                <button
                  onClick={() => router.push('/login')}
                  className="text-sm text-primary hover:underline"
                >
                  로그인하기
                </button>
              </div>
            ) : favoriteStations.length === 0 && favoriteRoutes.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">즐겨찾기한 정류소나 노선이 없습니다</p>
                <p className="text-xs text-muted-foreground/70 mt-1">정류소나 노선 검색 후 즐겨찾기해보세요</p>
              </div>
            ) : (
              <>
                {/* 즐겨찾기 정류소 */}
                {favoriteStations.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-2">즐겨찾기 정류소</h3>
                    <div className="space-y-1">
                      {favoriteStations.map((station) => (
                        <Card
                          key={station.stationId}
                          className="p-3 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => handleFavoriteStationClick(station)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">🚏</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{station.stationName}</p>
                              {station.arsId && (
                                <p className="text-xs text-muted-foreground">{station.arsId}</p>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* 즐겨찾기 노선 */}
                {favoriteRoutes.length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium text-muted-foreground mb-2">즐겨찾기 노선</h3>
                    <div className="space-y-1">
                      {favoriteRoutes.map((route) => (
                        <Card
                          key={route.busId}
                          className="p-3 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer"
                          onClick={() => handleFavoriteRouteClick(route)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">🚌</span>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{route.busNo}</p>
                              {route.startStationName && route.endStationName && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {route.startStationName} → {route.endStationName}
                                </p>
                              )}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 경로 탭 */}
        {activeTab === 'route' && !query && (
          <div>
            {!user ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground mb-2">로그인하면 길찾기 이력을 저장할 수 있어요</p>
                <button
                  onClick={() => router.push('/login')}
                  className="text-sm text-primary hover:underline"
                >
                  로그인하기
                </button>
              </div>
            ) : routeHistory.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground">길찾기 이력이 없습니다</p>
                <p className="text-xs text-muted-foreground/70 mt-1">길찾기를 하면 자동으로 저장됩니다</p>
              </div>
            ) : (
              <div className="space-y-1">
                {routeHistory.map((history) => (
                  <Card
                    key={history.id}
                    className="p-3 border-border/50 hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => handleRouteHistoryClick(history)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">🗺️</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{history.origin_name}</p>
                        <p className="text-xs text-muted-foreground truncate">→ {history.dest_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          {formatTimeAgo(history.created_at)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteRouteHistory(history.id);
                          }}
                          className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
