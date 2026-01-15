'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { loadKakaoMapScript, getCurrentPosition } from '@/lib/kakao';
import { MapHeader } from '@/components/main/MapHeader';
import { MainTabs } from '@/components/main/MainTabs';
import { VERSION, GIT_HASH } from '@/lib/version';

interface MyPlace {
  id: string;
  name: string;
  place_name: string;
  address: string | null;
  x: string;
  y: string;
  icon: 'home' | 'office' | 'pin';
}

const ICON_MAP: Record<string, string> = {
  home: '🏠',
  office: '🏢',
  pin: '📍',
};

const ICON_COLORS: Record<string, string> = {
  home: '#3B82F6',
  office: '#10B981',
  pin: '#EF4444',
};

export default function HomePage() {
  const router = useRouter();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<kakao.maps.Map | null>(null);
  const myPlaceMarkersRef = useRef<kakao.maps.CustomOverlay[]>([]);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [myPlaces, setMyPlaces] = useState<MyPlace[]>([]);

  // 내 장소 마커 표시
  const displayMyPlaceMarkers = useCallback((places: MyPlace[]) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // 기존 마커 제거
    myPlaceMarkersRef.current.forEach((marker) => marker.setMap(null));
    myPlaceMarkersRef.current = [];

    const kakao = window.kakao;

    places.forEach((place) => {
      const position = new kakao.maps.LatLng(parseFloat(place.y), parseFloat(place.x));
      const color = ICON_COLORS[place.icon] || ICON_COLORS.pin;

      const markerContent = document.createElement('div');
      markerContent.style.cursor = 'pointer';
      markerContent.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          transform: translateY(-50%);
        ">
          <div style="
            padding: 4px 8px;
            background: ${color};
            border-radius: 12px;
            color: white;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            gap: 4px;
          ">
            <span>${ICON_MAP[place.icon]}</span>
            <span>${place.name}</span>
          </div>
          <div style="
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-top: 6px solid ${color};
          "></div>
        </div>
      `;

      // 클릭 시 길찾기 페이지로 이동
      markerContent.onclick = () => {
        router.push(`/search?dest=${encodeURIComponent(place.place_name)}&destX=${place.x}&destY=${place.y}`);
      };

      const overlay = new kakao.maps.CustomOverlay({
        position,
        content: markerContent,
        yAnchor: 1,
      });

      overlay.setMap(map);
      myPlaceMarkersRef.current.push(overlay);
    });
  }, [router]);

  // 내 장소 불러오기
  useEffect(() => {
    const fetchMyPlaces = async () => {
      try {
        const response = await fetch('/api/my-places');
        const data = await response.json();
        setMyPlaces(data.places || []);
      } catch (error) {
        console.error('Failed to fetch my places:', error);
      }
    };

    fetchMyPlaces();
  }, []);

  // 내 장소 마커 업데이트
  useEffect(() => {
    if (mapLoaded && myPlaces.length > 0) {
      displayMyPlaceMarkers(myPlaces);
    }
  }, [mapLoaded, myPlaces, displayMyPlaceMarkers]);

  // 지도 초기화
  useEffect(() => {
    async function initMap() {
      try {
        await loadKakaoMapScript();

        let lat = 37.5665;
        let lng = 126.978;

        try {
          const position = await getCurrentPosition();
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        } catch {
          console.log('현재 위치를 가져올 수 없습니다. 기본 위치 사용.');
        }

        setCurrentLocation({ lat, lng });

        if (!mapRef.current) return;

        const kakao = window.kakao;
        const map = new kakao.maps.Map(mapRef.current, {
          center: new kakao.maps.LatLng(lat, lng),
          level: 5,
        });
        mapInstanceRef.current = map;

        // 현재 위치 마커
        const markerContent = `
          <div style="position: relative;">
            <div style="width: 16px; height: 16px; background: #3B82F6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 40px; height: 40px; background: rgba(59, 130, 246, 0.2); border-radius: 50%; animation: pulse 2s infinite;"></div>
          </div>
          <style>
            @keyframes pulse {
              0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(1.5); opacity: 0; }
            }
          </style>
        `;
        new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(lat, lng),
          content: markerContent,
          map: map,
        });

        setMapLoaded(true);
      } catch (err) {
        console.error('지도 초기화 실패:', err);
      }
    }

    initMap();
  }, []);

  // 현재 위치로 이동
  const moveToCurrentLocation = () => {
    if (!mapInstanceRef.current || !currentLocation) return;

    const position = new window.kakao.maps.LatLng(currentLocation.lat, currentLocation.lng);
    mapInstanceRef.current.setCenter(position);
    mapInstanceRef.current.setLevel(5);
  };

  // 검색창 클릭 핸들러
  const handleSearchClick = () => {
    router.push('/search-unified');
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-3rem)]">
      {/* 지도 영역 */}
      <div className="relative h-[35vh] min-h-[200px] flex-shrink-0">
        <div ref={mapRef} className="w-full h-full" />

        {/* 검색창 오버레이 */}
        <MapHeader onSearchClick={handleSearchClick} />

        {/* 현재 위치 버튼 */}
        <button
          onClick={moveToCurrentLocation}
          className="absolute bottom-3 right-3 z-10 w-10 h-10 bg-background/95 backdrop-blur-sm rounded-full shadow-lg flex items-center justify-center hover:bg-accent transition-colors border border-border/50"
        >
          <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>

        {/* 지도 로딩 */}
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-muted-foreground">지도 로딩 중...</span>
            </div>
          </div>
        )}
      </div>

      {/* 탭 영역 */}
      <MainTabs className="flex-1 overflow-hidden" />

      {/* Footer */}
      <footer className="flex-shrink-0 text-center text-[10px] text-muted-foreground/70 py-2 border-t border-border/50 bg-background">
        <span>v{VERSION} ({GIT_HASH}) · By specialrisk 2026.</span>
      </footer>
    </div>
  );
}
