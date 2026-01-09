'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createClient } from '@/lib/supabase/client';

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
  created_at: string;
}

export default function FavoritesPage() {
  const router = useRouter();
  const [stations, setStations] = useState<FavoriteStation[]>([]);
  const [routes, setRoutes] = useState<FavoriteRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchFavorites();
      } else {
        setLoading(false);
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

      setStations(stationsData.stations || []);
      setRoutes(routesData.routes || []);
    } catch (error) {
      console.error('Fetch favorites error:', error);
    } finally {
      setLoading(false);
    }
  };

  const removeStation = async (stationId: string) => {
    try {
      await fetch(`/api/favorites/stations?stationId=${stationId}`, {
        method: 'DELETE',
      });
      setStations(stations.filter((s) => s.station_id !== stationId));
    } catch (error) {
      console.error('Remove station error:', error);
    }
  };

  const removeRoute = async (busId: string) => {
    try {
      await fetch(`/api/favorites/routes?busId=${busId}`, {
        method: 'DELETE',
      });
      setRoutes(routes.filter((r) => r.bus_id !== busId));
    } catch (error) {
      console.error('Remove route error:', error);
    }
  };

  if (!user && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <p className="text-slate-500 mb-4">로그인이 필요한 기능입니다.</p>
        <Button
          onClick={() => router.push('/login')}
          className="bg-emerald-500 hover:bg-emerald-600"
        >
          로그인하기
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-slate-900 mb-4">즐겨찾기</h1>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-5 w-32 bg-slate-200 rounded" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <h1 className="text-xl font-bold text-slate-900 mb-4">즐겨찾기</h1>

      <Tabs defaultValue="stations">
        <TabsList className="w-full mb-4">
          <TabsTrigger value="stations" className="flex-1">
            정류소 ({stations.length})
          </TabsTrigger>
          <TabsTrigger value="routes" className="flex-1">
            노선 ({routes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="stations">
          {stations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-slate-500 mb-4">즐겨찾기한 정류소가 없습니다.</p>
              <Button
                variant="outline"
                onClick={() => router.push('/station/search')}
              >
                정류소 검색하기
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {stations.map((station) => (
                <Card key={station.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/station/${station.station_id}?name=${encodeURIComponent(station.station_name)}`
                        )
                      }
                    >
                      <p className="font-medium text-slate-900">
                        {station.station_name}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStation(station.station_id)}
                      className="text-red-500 hover:text-red-600"
                    >
                      삭제
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="routes">
          {routes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <p className="text-slate-500 mb-4">즐겨찾기한 노선이 없습니다.</p>
              <Button
                variant="outline"
                onClick={() => router.push('/bus/search')}
              >
                버스 검색하기
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {routes.map((route) => (
                <Card key={route.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() =>
                        router.push(
                          `/bus/${route.bus_id}?no=${encodeURIComponent(route.bus_no)}`
                        )
                      }
                    >
                      <p className="font-bold text-lg text-emerald-600">
                        {route.bus_no}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRoute(route.bus_id)}
                      className="text-red-500 hover:text-red-600"
                    >
                      삭제
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
