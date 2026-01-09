'use client';

import { useEffect, useRef, useState } from 'react';
import { loadKakaoMapScript, getCurrentPosition } from '@/lib/kakao';

interface MapContainerProps {
  className?: string;
  onLocationChange?: (lat: number, lng: number) => void;
}

import { cn } from '@/lib/utils';

export function MapContainer({ className, onLocationChange }: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let marker: any = null;

    async function initMap() {
      try {
        await loadKakaoMapScript();

        if (!mapRef.current) return;

        // 기본 위치 (서울시청)
        let lat = 37.5665;
        let lng = 126.978;

        // 현재 위치 가져오기
        try {
          const position = await getCurrentPosition();
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        } catch {
          console.log('현재 위치를 가져올 수 없습니다. 기본 위치 사용.');
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const kakao = (window as any).kakao;
        const center = new kakao.maps.LatLng(lat, lng);
        map = new kakao.maps.Map(mapRef.current, {
          center,
          level: 3,
        });

        marker = new kakao.maps.Marker({
          position: center,
          map,
        });

        onLocationChange?.(lat, lng);
        setIsLoading(false);
      } catch (err) {
        setError('지도를 불러오는데 실패했습니다.');
        setIsLoading(false);
        console.error(err);
      }
    }

    initMap();

    return () => {
      if (marker) {
        marker.setMap(null);
      }
    };
  }, [onLocationChange]);

  if (error) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", className)}>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <p className="text-muted-foreground">지도를 불러오는 중입니다...</p>
        </div>
      )}
      <div ref={mapRef} className="h-full w-full" />
    </div>
  );
}
