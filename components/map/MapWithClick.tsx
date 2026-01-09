'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadKakaoMapScript, getCurrentPosition } from '@/lib/kakao';
import { Button } from '@/components/ui/button';

interface SelectedLocation {
  lat: number;
  lng: number;
  address: string;
  placeName?: string;
}

interface MapWithClickProps {
  className?: string;
  onSelect: (location: SelectedLocation) => void;
  onCancel?: () => void;
  initialLat?: number;
  initialLng?: number;
}

export function MapWithClick({
  className,
  onSelect,
  onCancel,
  initialLat,
  initialLng,
}: MapWithClickProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstanceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geocoderRef = useRef<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);

  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    return new Promise((resolve) => {
      if (!geocoderRef.current) {
        resolve('주소를 찾을 수 없습니다');
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const kakao = (window as any).kakao;
      const coord = new kakao.maps.LatLng(lat, lng);

      geocoderRef.current.coord2Address(
        coord.getLng(),
        coord.getLat(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (result: any[], status: string) => {
          if (status === kakao.maps.services.Status.OK && result[0]) {
            const addr = result[0].road_address
              ? result[0].road_address.address_name
              : result[0].address.address_name;
            resolve(addr);
          } else {
            resolve('주소를 찾을 수 없습니다');
          }
        }
      );
    });
  }, []);

  const handleMapClick = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async (mouseEvent: any) => {
      const latlng = mouseEvent.latLng;
      const lat = latlng.getLat();
      const lng = latlng.getLng();

      // 마커 위치 업데이트
      if (markerRef.current) {
        markerRef.current.setPosition(latlng);
      }

      setIsSearchingAddress(true);

      // 역지오코딩으로 주소 가져오기
      const address = await reverseGeocode(lat, lng);

      setSelectedLocation({
        lat,
        lng,
        address,
      });
      setIsSearchingAddress(false);
    },
    [reverseGeocode]
  );

  useEffect(() => {
    async function initMap() {
      try {
        await loadKakaoMapScript();

        if (!mapRef.current) return;

        // 기본 위치 (서울시청)
        let lat = initialLat ?? 37.5665;
        let lng = initialLng ?? 126.978;

        // 초기 좌표가 없으면 현재 위치 가져오기
        if (!initialLat || !initialLng) {
          try {
            const position = await getCurrentPosition();
            lat = position.coords.latitude;
            lng = position.coords.longitude;
          } catch {
            console.log('현재 위치를 가져올 수 없습니다. 기본 위치 사용.');
          }
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const kakao = (window as any).kakao;
        const center = new kakao.maps.LatLng(lat, lng);

        const map = new kakao.maps.Map(mapRef.current, {
          center,
          level: 3,
        });
        mapInstanceRef.current = map;

        // 지오코더 초기화
        geocoderRef.current = new kakao.maps.services.Geocoder();

        // 마커 생성
        const marker = new kakao.maps.Marker({
          position: center,
          map,
        });
        markerRef.current = marker;

        // 지도 클릭 이벤트
        kakao.maps.event.addListener(map, 'click', handleMapClick);

        // 초기 위치의 주소 가져오기
        const address = await reverseGeocode(lat, lng);
        setSelectedLocation({ lat, lng, address });

        setIsLoading(false);
      } catch (err) {
        setError('지도를 불러오는데 실패했습니다.');
        setIsLoading(false);
        console.error(err);
      }
    }

    initMap();

    return () => {
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
    };
  }, [initialLat, initialLng, handleMapClick, reverseGeocode]);

  const handleConfirm = () => {
    if (selectedLocation) {
      onSelect(selectedLocation);
    }
  };

  const handleCurrentLocation = async () => {
    try {
      const position = await getCurrentPosition();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const kakao = (window as any).kakao;
      const latlng = new kakao.maps.LatLng(lat, lng);

      if (mapInstanceRef.current) {
        mapInstanceRef.current.setCenter(latlng);
      }
      if (markerRef.current) {
        markerRef.current.setPosition(latlng);
      }

      setIsSearchingAddress(true);
      const address = await reverseGeocode(lat, lng);
      setSelectedLocation({ lat, lng, address });
      setIsSearchingAddress(false);
    } catch {
      alert('현재 위치를 가져올 수 없습니다.');
    }
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 ${className}`}>
        <p className="text-slate-500">{error}</p>
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col ${className}`}>
      {/* 지도 영역 */}
      <div className="relative flex-1">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-slate-500">지도를 불러오는 중...</p>
            </div>
          </div>
        )}
        <div ref={mapRef} className="h-full w-full" />

        {/* 현재 위치 버튼 */}
        <button
          onClick={handleCurrentLocation}
          className="absolute bottom-4 right-4 z-10 bg-white rounded-full p-3 shadow-lg hover:bg-slate-50"
          title="현재 위치"
        >
          <svg
            className="w-5 h-5 text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>

      {/* 선택된 위치 정보 및 버튼 */}
      <div className="bg-white border-t border-slate-200 p-4">
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-1">선택된 위치</p>
          {isSearchingAddress ? (
            <p className="text-sm text-slate-400">주소를 찾는 중...</p>
          ) : selectedLocation ? (
            <p className="text-sm font-medium text-slate-900">
              {selectedLocation.address}
            </p>
          ) : (
            <p className="text-sm text-slate-400">지도를 클릭하여 위치를 선택하세요</p>
          )}
        </div>
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="outline" className="flex-1" onClick={onCancel}>
              취소
            </Button>
          )}
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={!selectedLocation || isSearchingAddress}
          >
            이 위치 선택
          </Button>
        </div>
      </div>
    </div>
  );
}
