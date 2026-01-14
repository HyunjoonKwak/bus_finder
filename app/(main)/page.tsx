'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useSearchStore } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import { PlaceSearchInput } from '@/components/search/PlaceSearchInput';

type TabType = 'favorites' | 'history' | 'commute';

interface FavoriteStation {
  id: string;
  station_id: string;
  station_name: string;
  created_at: string;
}

interface FavoriteRoute {
  id: string;
  bus_id: string;
  bus_no: string;
  bus_type?: number;
  created_at: string;
}

interface HistoryItem {
  id: string;
  origin_name: string;
  dest_name: string;
  boarded_at: string;
  total_time: number | null;
  route_data: Record<string, unknown>;
}

interface CommuteRoute {
  id: string;
  name: string;
  origin_name: string;
  origin_x: string;
  origin_y: string;
  dest_name: string;
  dest_x: string;
  dest_y: string;
  is_active: boolean;
  created_at: string;
}

const quickMenus = [
  { href: '/bus', label: '정류소', icon: '🚏', description: '도착 정보' },
  { href: '/bus?tab=route', label: '노선', icon: '🚌', description: '노선 조회' },
  { href: '/bus?tab=search', label: '길찾기', icon: '🗺️', description: '경로 검색' },
  { href: '/explore', label: '지도', icon: '📍', description: '주변 탐색' },
];

export default function HomePage() {
  const router = useRouter();
  const { recentSearches, clearSearches } = useSearchStore();

  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('favorites');

  // 즐겨찾기 상태
  const [favoriteStations, setFavoriteStations] = useState<FavoriteStation[]>([]);
  const [favoriteRoutes, setFavoriteRoutes] = useState<FavoriteRoute[]>([]);

  // 기록 상태
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // 출퇴근 경로 상태
  const [commuteRoutes, setCommuteRoutes] = useState<CommuteRoute[]>([]);
  const [showCommuteForm, setShowCommuteForm] = useState(false);
  const [commuteFormData, setCommuteFormData] = useState({
    name: '',
    origin_name: '',
    origin_x: '',
    origin_y: '',
    dest_name: '',
    dest_x: '',
    dest_y: '',
  });

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchAllData();
      } else {
        setLoading(false);
      }
    });
  }, []);

  const fetchAllData = async () => {
    try {
      const [favStationsRes, favRoutesRes, historyRes, commuteRes] = await Promise.all([
        fetch('/api/favorites/stations'),
        fetch('/api/favorites/routes'),
        fetch('/api/history'),
        fetch('/api/commute'),
      ]);

      const [favStationsData, favRoutesData, historyData, commuteData] = await Promise.all([
        favStationsRes.json(),
        favRoutesRes.json(),
        historyRes.json(),
        commuteRes.json(),
      ]);

      setFavoriteStations(favStationsData.stations || []);
      setFavoriteRoutes(favRoutesData.routes || []);
      setHistory(historyData.history || []);
      setCommuteRoutes(commuteData.routes || []);
    } catch (error) {
      console.error('Fetch data error:', error);
    } finally {
      setLoading(false);
    }
  };

  // 즐겨찾기 삭제
  const removeStation = async (stationId: string) => {
    try {
      await fetch(`/api/favorites/stations?stationId=${stationId}`, { method: 'DELETE' });
      setFavoriteStations(favoriteStations.filter((s) => s.station_id !== stationId));
    } catch (error) {
      console.error('Remove station error:', error);
    }
  };

  const removeRoute = async (busId: string) => {
    try {
      await fetch(`/api/favorites/routes?busId=${busId}`, { method: 'DELETE' });
      setFavoriteRoutes(favoriteRoutes.filter((r) => r.bus_id !== busId));
    } catch (error) {
      console.error('Remove route error:', error);
    }
  };

  // 출퇴근 경로 추가/삭제
  const handleAddCommute = async () => {
    if (!commuteFormData.name || !commuteFormData.origin_name || !commuteFormData.dest_name) {
      alert('모든 필드를 입력해주세요.');
      return;
    }
    if (!commuteFormData.origin_x || !commuteFormData.dest_x) {
      alert('출발지와 도착지를 검색하여 선택해주세요.');
      return;
    }

    try {
      const response = await fetch('/api/commute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commuteFormData),
      });

      if (response.ok) {
        setCommuteFormData({
          name: '',
          origin_name: '',
          origin_x: '',
          origin_y: '',
          dest_name: '',
          dest_x: '',
          dest_y: '',
        });
        setShowCommuteForm(false);
        const data = await fetch('/api/commute').then((r) => r.json());
        setCommuteRoutes(data.routes || []);
      }
    } catch (error) {
      console.error('Add commute error:', error);
    }
  };

  const handleDeleteCommute = async (id: string) => {
    if (!confirm('이 출퇴근 경로를 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/commute?id=${id}`, { method: 'DELETE' });
      setCommuteRoutes(commuteRoutes.filter((r) => r.id !== id));
    } catch (error) {
      console.error('Delete commute error:', error);
    }
  };

  const handleCommuteSearch = (route: CommuteRoute, reverse = false) => {
    if (!route.origin_x || !route.dest_x) {
      alert('좌표 정보가 없습니다.');
      return;
    }
    const params = new URLSearchParams({
      tab: 'search',
      sx: reverse ? route.dest_x : route.origin_x,
      sy: reverse ? route.dest_y : route.origin_y,
      ex: reverse ? route.origin_x : route.dest_x,
      ey: reverse ? route.origin_y : route.dest_y,
      sname: reverse ? route.dest_name : route.origin_name,
      ename: reverse ? route.origin_name : route.dest_name,
    });
    router.push(`/bus?${params.toString()}`);
  };

  // 기록 클릭 핸들러
  const handleHistoryClick = (item: HistoryItem) => {
    if (item.route_data) {
      sessionStorage.setItem('selectedRoute', JSON.stringify(item.route_data));
      router.push(`/routes/${item.id}`);
    }
  };

  // 최근 검색 클릭
  const handleRecentSearchClick = (origin: string, destination: string) => {
    router.push(`/bus?tab=search&origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(destination)}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const tabs = [
    { id: 'favorites' as TabType, label: '즐겨찾기', count: favoriteStations.length + favoriteRoutes.length },
    { id: 'history' as TabType, label: '기록', count: history.length },
    { id: 'commute' as TabType, label: '출퇴근', count: commuteRoutes.length },
  ];

  return (
    <div className="min-h-[calc(100dvh-3rem)] bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* 빠른 메뉴 버튼 4개 */}
        <div className="grid grid-cols-4 gap-2">
          {quickMenus.map((menu) => (
            <Link key={menu.href} href={menu.href}>
              <Card className="p-3 h-full flex flex-col items-center justify-center hover:bg-accent/50 transition-colors cursor-pointer border-border/50">
                <span className="text-2xl mb-1">{menu.icon}</span>
                <span className="text-xs font-medium text-foreground">{menu.label}</span>
                <span className="text-[10px] text-muted-foreground hidden sm:block">{menu.description}</span>
              </Card>
            </Link>
          ))}
        </div>

        {/* 비로그인 상태 */}
        {!loading && !user && (
          <Card className="p-4 border-border/50 bg-primary/5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-sm text-foreground">로그인하고 더 편리하게</h3>
                <p className="text-xs text-muted-foreground">즐겨찾기, 기록 등 개인화 기능 이용</p>
              </div>
              <div className="flex gap-2">
                <Link href="/login">
                  <Button size="sm">로그인</Button>
                </Link>
              </div>
            </div>
          </Card>
        )}

        {/* 로그인 상태 - 탭 콘텐츠 */}
        {user && (
          <>
            {/* 탭 헤더 */}
            <div className="flex border-b border-border">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex-1 py-2.5 text-sm font-medium transition-colors relative',
                    activeTab === tab.id
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={cn(
                      'ml-1 text-xs',
                      activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      ({tab.count})
                    </span>
                  )}
                  {activeTab === tab.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                  )}
                </button>
              ))}
            </div>

            {/* 즐겨찾기 탭 */}
            {activeTab === 'favorites' && (
              <div className="space-y-4">
                {/* 즐겨찾기 정류소 */}
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <span>🚏</span> 정류소
                  </h3>
                  {favoriteStations.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">즐겨찾기한 정류소가 없습니다</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {favoriteStations.map((station) => (
                        <Card key={station.id} className="p-3 border-border/50 hover:bg-accent/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <button
                              className="flex-1 text-left truncate"
                              onClick={() => router.push(`/station/${station.station_id}?name=${encodeURIComponent(station.station_name)}`)}
                            >
                              <span className="text-sm font-medium">{station.station_name}</span>
                            </button>
                            <button
                              onClick={() => removeStation(station.station_id)}
                              className="p-1.5 text-muted-foreground hover:text-destructive"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* 즐겨찾기 노선 */}
                <div>
                  <h3 className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <span>🚌</span> 노선
                  </h3>
                  {favoriteRoutes.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">즐겨찾기한 노선이 없습니다</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {favoriteRoutes.map((route) => (
                        <Card key={route.id} className="px-3 py-1.5 border-border/50 hover:bg-accent/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => router.push(`/bus/${route.bus_id}?no=${encodeURIComponent(route.bus_no)}`)}
                              className="font-bold text-sm text-primary"
                            >
                              {route.bus_no}
                            </button>
                            <button
                              onClick={() => removeRoute(route.bus_id)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* 최근 검색 */}
                {recentSearches.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                        <span>🔍</span> 최근 검색
                      </h3>
                      <button onClick={clearSearches} className="text-xs text-muted-foreground hover:text-foreground">
                        삭제
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {recentSearches.slice(0, 5).map((search, index) => (
                        <Card
                          key={index}
                          onClick={() => handleRecentSearchClick(search.origin, search.destination)}
                          className="p-2.5 cursor-pointer hover:bg-accent/50 transition-colors border-border/50"
                        >
                          <div className="flex items-center text-sm">
                            <span className="font-medium truncate">{search.origin}</span>
                            <span className="mx-2 text-muted-foreground">→</span>
                            <span className="truncate">{search.destination}</span>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {favoriteStations.length === 0 && favoriteRoutes.length === 0 && recentSearches.length === 0 && (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-foreground mb-2">즐겨찾기가 없습니다</p>
                    <Link href="/bus">
                      <Button size="sm" variant="outline">정류소 검색하기</Button>
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* 기록 탭 */}
            {activeTab === 'history' && (
              <div>
                {history.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-foreground mb-1">탑승 기록이 없습니다</p>
                    <p className="text-xs text-muted-foreground/70">경로를 검색하고 탑승 시작을 눌러보세요</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map((item) => (
                      <Card
                        key={item.id}
                        className="p-3 cursor-pointer hover:bg-accent/50 transition-colors border-border/50"
                        onClick={() => handleHistoryClick(item)}
                      >
                        <div className="flex items-center text-sm mb-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                          <span className="font-medium truncate">{item.origin_name}</span>
                          <svg className="w-3 h-3 mx-1.5 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                          </svg>
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
                          <span className="truncate">{item.dest_name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatDate(item.boarded_at)}</span>
                          {item.total_time && <span>· {item.total_time}분</span>}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 출퇴근 탭 */}
            {activeTab === 'commute' && (
              <div>
                <div className="flex justify-end mb-3">
                  <Button variant="outline" size="sm" onClick={() => setShowCommuteForm(!showCommuteForm)}>
                    {showCommuteForm ? '취소' : '+ 추가'}
                  </Button>
                </div>

                {showCommuteForm && (
                  <Card className="p-4 mb-4 border-border/50">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">경로 이름</label>
                        <Input
                          placeholder="예: 출근길"
                          value={commuteFormData.name}
                          onChange={(e) => setCommuteFormData({ ...commuteFormData, name: e.target.value })}
                          className="h-9"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">출발지</label>
                        <PlaceSearchInput
                          value={commuteFormData.origin_name}
                          onChange={(value) => setCommuteFormData({ ...commuteFormData, origin_name: value, origin_x: '', origin_y: '' })}
                          onSelect={(place) => setCommuteFormData({
                            ...commuteFormData,
                            origin_name: place.name,
                            origin_x: place.x,
                            origin_y: place.y,
                          })}
                          placeholder="장소를 검색하세요"
                          label="출발"
                          labelColor="text-emerald-600"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-foreground mb-1">도착지</label>
                        <PlaceSearchInput
                          value={commuteFormData.dest_name}
                          onChange={(value) => setCommuteFormData({ ...commuteFormData, dest_name: value, dest_x: '', dest_y: '' })}
                          onSelect={(place) => setCommuteFormData({
                            ...commuteFormData,
                            dest_name: place.name,
                            dest_x: place.x,
                            dest_y: place.y,
                          })}
                          placeholder="장소를 검색하세요"
                          label="도착"
                          labelColor="text-red-600"
                        />
                      </div>
                      <Button className="w-full" size="sm" onClick={handleAddCommute}>저장</Button>
                    </div>
                  </Card>
                )}

                {commuteRoutes.length === 0 && !showCommuteForm ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-foreground mb-1">등록된 출퇴근 경로가 없습니다</p>
                    <p className="text-xs text-muted-foreground/70">자주 이용하는 경로를 등록해보세요</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {commuteRoutes.map((route) => (
                      <Card key={route.id} className="p-3 border-border/50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm">{route.name}</h3>
                            <div className="flex items-center text-xs text-muted-foreground mt-0.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
                              <span className="truncate">{route.origin_name}</span>
                              <span className="mx-1">→</span>
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1" />
                              <span className="truncate">{route.dest_name}</span>
                            </div>
                          </div>
                          <button onClick={() => handleDeleteCommute(route.id)} className="p-1 text-muted-foreground hover:text-destructive">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <Button className="flex-1" size="sm" onClick={() => handleCommuteSearch(route)} disabled={!route.origin_x}>
                            검색
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleCommuteSearch(route, true)} disabled={!route.origin_x}>
                            역방향
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* 로딩 상태 */}
        {loading && (
          <div className="py-12 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
