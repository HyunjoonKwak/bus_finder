'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrivalInfo } from '@/components/station/ArrivalInfo';
import type { RealtimeArrivalInfo } from '@/lib/odsay/types';
import { createClient } from '@/lib/supabase/client';

interface User {
  id: string;
}

interface TrackingTarget {
  bus_id: string;
}

function StationDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const stationId = params.id as string;
  const stationName = searchParams.get('name') || '정류소';

  const [arrivals, setArrivals] = useState<RealtimeArrivalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [trackingTargets, setTrackingTargets] = useState<string[]>([]);

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

  const fetchTrackingTargets = useCallback(async () => {
    try {
      const response = await fetch('/api/tracking/targets');
      const data = await response.json();
      const targets = data.targets || [];
      // 현재 정류소에서 추적 중인 버스 ID 목록
      const busIds = targets
        .filter((t: TrackingTarget & { station_id: string }) => t.station_id === stationId)
        .map((t: TrackingTarget) => t.bus_id);
      setTrackingTargets(busIds);
    } catch (error) {
      console.error('Fetch tracking targets error:', error);
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
        // 추적 대상 확인
        fetchTrackingTargets();
      }
    });

    // 도착 정보 가져오기
    fetchArrivals();

    // 5초마다 새로고침
    const interval = setInterval(fetchArrivals, 5000);

    return () => clearInterval(interval);
  }, [stationId, fetchArrivals, fetchTrackingTargets]);

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

  const toggleTracking = async (busId: string, busNo: string) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    const isTracking = trackingTargets.includes(busId);

    try {
      if (isTracking) {
        // 추적 대상에서 제거하려면 먼저 ID를 찾아야 함
        const response = await fetch('/api/tracking/targets');
        const data = await response.json();
        const target = data.targets?.find(
          (t: TrackingTarget & { station_id: string }) =>
            t.bus_id === busId && t.station_id === stationId
        );
        if (target) {
          await fetch(`/api/tracking/targets?id=${(target as TrackingTarget & { id: string }).id}`, {
            method: 'DELETE',
          });
        }
      } else {
        await fetch('/api/tracking/targets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bus_id: busId,
            bus_no: busNo,
            station_id: stationId,
            station_name: stationName,
          }),
        });
      }
      fetchTrackingTargets();
    } catch (error) {
      console.error('Toggle tracking error:', error);
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

      <ArrivalInfo
        arrivals={arrivals}
        loading={loading}
        trackingTargets={trackingTargets}
        onToggleTracking={user ? toggleTracking : undefined}
      />

      {!loading && arrivals.length === 0 && (
        <p className="text-center text-slate-500 text-sm mt-4">
          현재 운행 중인 버스가 없습니다.
        </p>
      )}
    </div>
  );
}

export default function StationDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-4">
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      }
    >
      <StationDetailContent />
    </Suspense>
  );
}
