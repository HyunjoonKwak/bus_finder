'use client';

import { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrivalInfo } from '@/components/station/ArrivalInfo';
import type { RealtimeArrivalInfo } from '@/lib/odsay/types';
import { createClient } from '@/lib/supabase/client';
import { useSearchStore } from '@/lib/store';

const REFRESH_INTERVAL = 15; // 15초마다 새로고침

interface User {
  id: string;
}

interface TrackingTarget {
  bus_id: string;
}

function StationDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { addRecentStation } = useSearchStore();
  const stationId = params.id as string;
  const stationName = searchParams.get('name') || '정류소';
  const arsId = searchParams.get('arsId') || '';

  const [arrivals, setArrivals] = useState<RealtimeArrivalInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [trackingTargets, setTrackingTargets] = useState<string[]>([]);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const fetchArrivals = useCallback(async () => {
    try {
      // 공공데이터 API 사용 (서울/경기 자동 판단)
      const params = new URLSearchParams();
      params.set('stationId', stationId);
      if (arsId) params.set('arsId', arsId);

      const response = await fetch(`/api/bus/arrival?${params.toString()}`);
      const data = await response.json();

      // 응답 형식을 RealtimeArrivalInfo로 변환
      interface ArrivalApiItem {
        routeId?: string;
        routeName?: string;
        routeType?: number;
        predictTimeSec1?: number;
        predictTimeSec2?: number;
        locationNo1?: number;
        locationNo2?: number;
        direction?: string;
        plateNo1?: string;
        plateNo2?: string;
        remainSeat1?: number;
        remainSeat2?: number;
        lowPlate1?: boolean;
        lowPlate2?: boolean;
        crowded1?: number;
        crowded2?: number;
      }
      const formattedArrivals = (data.arrivals || []).map((item: ArrivalApiItem) => ({
        routeID: item.routeId || '',
        routeNm: item.routeName,
        routeType: item.routeType,
        arrival1: item.predictTimeSec1 ? {
          arrivalSec: item.predictTimeSec1,
          leftStation: item.locationNo1 || 0,
          busPosition: item.direction,
          busPlateNo: item.plateNo1,
          remainSeat: item.remainSeat1,
          lowPlate: item.lowPlate1,
          crowded: item.crowded1,
        } : undefined,
        arrival2: item.predictTimeSec2 ? {
          arrivalSec: item.predictTimeSec2,
          leftStation: item.locationNo2 || 0,
          busPlateNo: item.plateNo2,
          remainSeat: item.remainSeat2,
          lowPlate: item.lowPlate2,
          crowded: item.crowded2,
        } : undefined,
      }));

      setArrivals(formattedArrivals);
    } catch (error) {
      console.error('Fetch arrivals error:', error);
    } finally {
      setLoading(false);
    }
  }, [stationId, arsId]);

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

  // 카운트다운 리셋
  const resetCountdown = useCallback(() => {
    setCountdown(REFRESH_INTERVAL);
  }, []);

  // 수동 새로고침
  const handleManualRefresh = useCallback(() => {
    fetchArrivals();
    resetCountdown();
  }, [fetchArrivals, resetCountdown]);

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

    // 최근 검색 이력에 저장
    addRecentStation({
      stationId,
      stationName,
      arsId: arsId || undefined,
    });

    // 도착 정보 가져오기
    fetchArrivals();

    // 카운트다운 타이머 (1초마다)
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchArrivals();
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
  }, [stationId, fetchArrivals, fetchTrackingTargets]);

  // 버스 상세 페이지로 이동
  const handleBusClick = (busId: string, busNo: string) => {
    router.push(`/bus/${busId}?no=${encodeURIComponent(busNo)}`);
  };

  const checkFavorite = async (userId: string) => {
    try {
      const response = await fetch(`/api/favorites/stations`);
      const data = await response.json();
      const favorites = data.stations || [];
      interface FavoriteStationItem { station_id: string }
      setIsFavorite(
        favorites.some((f: FavoriteStationItem) => f.station_id === stationId)
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
          <h1 className="text-xl font-bold text-foreground">{stationName}</h1>
          <p className="text-xs text-muted-foreground">정류소 ID: {stationId}</p>
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
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-medium text-foreground">실시간 도착 정보</h2>
          <span className="text-xs text-muted-foreground">
            {countdown}초 후 갱신
          </span>
        </div>
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

      <ArrivalInfo
        arrivals={arrivals}
        loading={loading}
        trackingTargets={trackingTargets}
        onToggleTracking={user ? toggleTracking : undefined}
        onBusClick={handleBusClick}
      />

      {!loading && arrivals.length === 0 && (
        <div className="text-center text-muted-foreground text-sm mt-4 space-y-2">
          <p>현재 실시간 도착 정보를 제공하지 않는 정류소입니다.</p>
          <p className="text-xs">경기도 일부 지역은 실시간 정보 준비 중입니다.</p>
        </div>
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
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        </div>
      }
    >
      <StationDetailContent />
    </Suspense>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
