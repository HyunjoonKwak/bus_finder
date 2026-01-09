'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BusStationInfo, BusRealTimeInfo } from '@/lib/odsay/types';
import { createClient } from '@/lib/supabase/client';

export default function BusDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const busId = params.id as string;
  const busNo = searchParams.get('no') || '버스';

  const [stations, setStations] = useState<BusStationInfo[]>([]);
  const [busPositions, setBusPositions] = useState<BusRealTimeInfo[]>([]);
  const [busInfo, setBusInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [user, setUser] = useState<any>(null);

  const fetchBusDetail = useCallback(async () => {
    try {
      const response = await fetch(`/api/odsay/bus/location?busId=${busId}`);
      const data = await response.json();
      setStations(data.stations || []);
      setBusPositions(data.realtime || []);
      if (data.lane && data.lane.length > 0) {
        setBusInfo(data.lane[0]);
      }
    } catch (error) {
      console.error('Fetch bus detail error:', error);
    } finally {
      setLoading(false);
    }
  }, [busId]);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        checkFavorite(user.id);
      }
    });

    fetchBusDetail();

    // 10초마다 버스 위치 새로고침
    const interval = setInterval(fetchBusDetail, 10000);

    return () => clearInterval(interval);
  }, [busId, fetchBusDetail]);

  const checkFavorite = async (userId: string) => {
    try {
      const response = await fetch(`/api/favorites/routes`);
      const data = await response.json();
      const favorites = data.routes || [];
      setIsFavorite(favorites.some((f: any) => f.bus_id === busId));
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

  if (loading) {
    return (
      <div className="px-4 py-4">
        <div className="animate-pulse">
          <div className="h-8 w-32 bg-slate-200 rounded mb-4" />
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-slate-200 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-emerald-600">{busNo}</h1>
          {busInfo && (
            <p className="text-xs text-slate-500">
              {busInfo.busStartPoint} → {busInfo.busEndPoint}
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
        <div className="flex gap-4 text-xs text-slate-500 mb-4">
          {busInfo.busFirstTime && <span>첫차: {busInfo.busFirstTime}</span>}
          {busInfo.busLastTime && <span>막차: {busInfo.busLastTime}</span>}
          {busInfo.busInterval && <span>배차: {busInfo.busInterval}분</span>}
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-slate-700">
          경유 정류소 ({stations.length}개)
        </h2>
        <div className="flex items-center gap-2">
          {busPositions.length > 0 && (
            <Badge className="bg-emerald-500">
              운행 중 {busPositions.length}대
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchBusDetail}
            className="text-xs"
          >
            새로고침
          </Button>
        </div>
      </div>

      <div className="relative">
        {/* 노선 라인 */}
        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-emerald-200" />

        <div className="space-y-1">
          {stations.map((station, index) => {
            const busAtStation = getBusAtStation(station.idx);
            return (
              <Card
                key={station.stationID}
                className={`p-3 pl-10 relative ${
                  busAtStation ? 'bg-emerald-50 border-emerald-300' : ''
                }`}
              >
                {/* 정류장 마커 */}
                <div
                  className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 ${
                    busAtStation
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'bg-white border-emerald-400'
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
                    <p className="font-medium text-slate-900 text-sm">
                      {station.stationName}
                    </p>
                    {station.arsID && (
                      <p className="text-xs text-slate-500">
                        {station.arsID}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">{index + 1}</span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
