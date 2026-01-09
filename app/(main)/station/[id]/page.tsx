'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrivalInfo } from '@/components/station/ArrivalInfo';
import type { RealtimeArrivalInfo } from '@/lib/odsay/types';
import { createClient } from '@/lib/supabase/client';

export default function StationDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const stationId = params.id as string;
  const stationName = searchParams.get('name') || '정류소';

  const [arrivals, setArrivals] = useState<RealtimeArrivalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [user, setUser] = useState<any>(null);

  const fetchArrivals = useCallback(async () => {
    try {
      const response = await fetch(
        `/api/odsay/station/arrival?stationId=${stationId}`
      );
      const data = await response.json();
      setArrivals(data.arrivals || []);
    } catch (error) {
      console.error('Fetch arrivals error:', error);
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  useEffect(() => {
    const supabase = createClient();

    // 사용자 확인
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        // 즐겨찾기 여부 확인
        checkFavorite(user.id);
      }
    });

    // 도착 정보 가져오기
    fetchArrivals();

    // 5초마다 새로고침
    const interval = setInterval(fetchArrivals, 5000);

    return () => clearInterval(interval);
  }, [stationId, fetchArrivals]);

  const checkFavorite = async (userId: string) => {
    try {
      const response = await fetch(`/api/favorites/stations`);
      const data = await response.json();
      const favorites = data.stations || [];
      setIsFavorite(
        favorites.some((f: any) => f.station_id === stationId)
      );
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
        await fetch(`/api/favorites/stations?stationId=${stationId}`, {
          method: 'DELETE',
        });
      } else {
        await fetch('/api/favorites/stations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            station_id: stationId,
            station_name: stationName,
          }),
        });
      }
      setIsFavorite(!isFavorite);
    } catch (error) {
      console.error('Toggle favorite error:', error);
    }
  };

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{stationName}</h1>
          <p className="text-xs text-slate-500">정류소 ID: {stationId}</p>
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

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-slate-700">실시간 도착 정보</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchArrivals}
          className="text-xs"
        >
          새로고침
        </Button>
      </div>

      <ArrivalInfo arrivals={arrivals} loading={loading} />

      {!loading && arrivals.length === 0 && (
        <p className="text-center text-slate-500 text-sm mt-4">
          현재 운행 중인 버스가 없습니다.
        </p>
      )}
    </div>
  );
}
