'use client';

import { useEffect, useRef, useState } from 'react';
import { loadKakaoMapScript, getCurrentPosition } from '@/lib/kakao';
import { cn } from '@/lib/utils';

interface MapContainerProps {
  className?: string;
  onLocationChange?: (lat: number, lng: number) => void;
  onMapClick?: (lat: number, lng: number, address: string) => void;
  showClickMarker?: boolean;
  onSetOrigin?: (lat: number, lng: number, address: string) => void;
  onSetDestination?: (lat: number, lng: number, address: string) => void;
}

export function MapContainer({
  className,
  onLocationChange,
  onMapClick,
  showClickMarker = false,
  onSetOrigin,
  onSetDestination,
}: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const clickMarkerRef = useRef<any>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clickedLocation, setClickedLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);

  // 팝업 외부 클릭 시 닫기
  useEffect(() => {
    if (!clickedLocation) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(event.target as Node)) {
        setClickedLocation(null);
        // 클릭 마커도 제거
        if (clickMarkerRef.current) {
          clickMarkerRef.current.setMap(null);
          clickMarkerRef.current = null;
        }
      }
    };

    // 약간의 지연 후 이벤트 리스너 추가 (지도 클릭 이벤트와 충돌 방지)
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [clickedLocation]);

  useEffect(() => {
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

        const kakao = (window as any).kakao;
        const center = new kakao.maps.LatLng(lat, lng);
        const map = new kakao.maps.Map(mapRef.current, {
          center,
          level: 3,
        });
        mapInstanceRef.current = map;

        // 줌 컨트롤 추가
        const zoomControl = new kakao.maps.ZoomControl();
        map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);

        // 현재 위치 마커
        markerRef.current = new kakao.maps.Marker({
          position: center,
          map,
        });

        // 지도 클릭 이벤트
        if (onMapClick || showClickMarker) {
          kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
            const latlng = mouseEvent.latLng;
            const clickLat = latlng.getLat();
            const clickLng = latlng.getLng();

            // 클릭 마커 표시
            if (showClickMarker) {
              if (clickMarkerRef.current) {
                clickMarkerRef.current.setPosition(latlng);
              } else {
                clickMarkerRef.current = new kakao.maps.Marker({
                  position: latlng,
                  map,
                  image: new kakao.maps.MarkerImage(
                    'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png',
                    new kakao.maps.Size(24, 35)
                  ),
                });
              }
            }

            // 주소 변환 (Geocoder)
            if (kakao.maps.services) {
              const geocoder = new kakao.maps.services.Geocoder();
              geocoder.coord2Address(clickLng, clickLat, (result: any, status: any) => {
                let address = '';
                if (status === kakao.maps.services.Status.OK && result[0]) {
                  address = result[0].road_address?.address_name || result[0].address?.address_name || '';
                }
                setClickedLocation({ lat: clickLat, lng: clickLng, address });
                onMapClick?.(clickLat, clickLng, address);
              });
            } else {
              setClickedLocation({ lat: clickLat, lng: clickLng, address: '' });
              onMapClick?.(clickLat, clickLng, '');
            }
          });
        }

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
      if (markerRef.current) {
        markerRef.current.setMap(null);
      }
      if (clickMarkerRef.current) {
        clickMarkerRef.current.setMap(null);
      }
    };
  }, []);

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

      {/* 클릭한 위치 정보 표시 */}
      {clickedLocation && showClickMarker && (
        <div
          ref={popupRef}
          className="absolute top-4 left-4 right-4 bg-background/95 backdrop-blur-sm rounded-lg shadow-lg p-3 z-10"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                선택한 위치
              </p>
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {clickedLocation.address || `${clickedLocation.lat.toFixed(6)}, ${clickedLocation.lng.toFixed(6)}`}
              </p>
            </div>
            <button
              onClick={() => {
                setClickedLocation(null);
                if (clickMarkerRef.current) {
                  clickMarkerRef.current.setMap(null);
                  clickMarkerRef.current = null;
                }
              }}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="닫기"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {(onSetOrigin || onSetDestination) && (
            <div className="flex gap-2 mt-2">
              {onSetOrigin && (
                <button
                  onClick={() => onSetOrigin(clickedLocation.lat, clickedLocation.lng, clickedLocation.address)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  출발지로 설정
                </button>
              )}
              {onSetDestination && (
                <button
                  onClick={() => onSetDestination(clickedLocation.lat, clickedLocation.lng, clickedLocation.address)}
                  className="flex-1 px-3 py-1.5 text-xs font-medium bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
                >
                  도착지로 설정
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
