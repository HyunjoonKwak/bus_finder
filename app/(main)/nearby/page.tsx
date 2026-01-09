'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StationList } from '@/components/station/StationList';
import type { NearbyStationInfo, StationInfo } from '@/lib/odsay/types';

export default function NearbyPage() {
  const router = useRouter();
  const [stations, setStations] = useState<NearbyStationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ x: number; y: number } | null>(
    null
  );

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const getCurrentLocation = () => {
    setLoading(true);
    setError(null);

    if (!navigator.geolocation) {
      setError('이 브라우저에서는 위치 서비스를 지원하지 않습니다.');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { longitude, latitude } = position.coords;
        setLocation({ x: longitude, y: latitude });
        await fetchNearbyStations(longitude, latitude);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setError('위치 정보를 가져올 수 없습니다. 위치 권한을 확인해주세요.');
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const fetchNearbyStations = async (x: number, y: number) => {
    try {
      const response = await fetch(
        `/api/odsay/station/nearby?x=${x}&y=${y}&radius=500`
      );
      const data = await response.json();
      setStations(data.stations || []);
    } catch (err) {
      console.error('Fetch nearby stations error:', err);
      setError('주변 정류소를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (station: StationInfo | NearbyStationInfo) => {
    router.push(
      `/station/${station.stationID}?name=${encodeURIComponent(station.stationName)}`
    );
  };

  if (loading) {
    return (
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-slate-900 mb-4">주변 정류소</h1>
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-slate-500">현재 위치를 확인하는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-slate-900 mb-4">주변 정류소</h1>
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-red-500 mb-4">{error}</p>
          <Button onClick={getCurrentLocation}>다시 시도</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">주변 정류소</h1>
        <Button variant="outline" size="sm" onClick={getCurrentLocation}>
          위치 새로고침
        </Button>
      </div>

      {stations.length > 0 ? (
        <>
          <p className="text-sm text-slate-500 mb-3">
            반경 500m 내 {stations.length}개의 정류소
          </p>
          <StationList
            stations={stations}
            onSelect={handleSelect}
            showDistance
          />
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-slate-500">주변에 정류소가 없습니다.</p>
        </div>
      )}
    </div>
  );
}
