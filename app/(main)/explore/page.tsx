'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { loadKakaoMapScript, getCurrentPosition } from '@/lib/kakao';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    kakao: any;
  }
}

interface Place {
  id: string;
  place_name: string;
  category_name: string;
  category_group_name: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  place_url: string;
  distance: string;
}

const CATEGORIES = [
  { code: 'FD6', name: '음식점', icon: '🍽️' },
  { code: 'CE7', name: '카페', icon: '☕' },
  { code: 'CS2', name: '편의점', icon: '🏪' },
  { code: 'SW8', name: '지하철', icon: '🚇' },
  { code: 'BK9', name: '은행', icon: '🏦' },
  { code: 'OL7', name: '주유소', icon: '⛽' },
  { code: 'AD5', name: '숙박', icon: '🏨' },
  { code: 'HP8', name: '병원', icon: '🏥' },
  { code: 'PM9', name: '약국', icon: '💊' },
  { code: 'MT1', name: '마트', icon: '🛒' },
  { code: 'AT4', name: '관광', icon: '🗼' },
  { code: 'CT1', name: '문화', icon: '🎭' },
];

type TabType = 'search' | 'category' | 'result';

export default function ExplorePage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const psRef = useRef<any>(null);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const geocoderRef = useRef<any>(null);

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
          level: 4,
        });
        mapInstanceRef.current = map;

        psRef.current = new kakao.maps.services.Places(map);
        geocoderRef.current = new kakao.maps.services.Geocoder();

        // 현재 위치 마커
        const markerContent = `
          <div style="position: relative;">
            <div style="width: 16px; height: 16px; background: #3B82F6; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
          </div>
        `;
        new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(lat, lng),
          content: markerContent,
          map: map,
        });

        setMapLoaded(true);
      } catch (err) {
        console.error('지도 초기화 실패:', err);
        setError('지도를 불러오는데 실패했습니다.');
      }
    }

    initMap();
  }, []);

  // 지도 이동/확대 시 재검색
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const kakao = window.kakao;

    const idleHandler = () => {
      if (selectedCategory && psRef.current) {
        psRef.current.categorySearch(
          selectedCategory,
          (data: Place[], status: string) => {
            if (status === kakao.maps.services.Status.OK) {
              setPlaces(data);
              clearMarkers();
              displayMarkers(data);
            }
          },
          { useMapBounds: true }
        );
      }
    };

    kakao.maps.event.addListener(map, 'idle', idleHandler);

    return () => {
      kakao.maps.event.removeListener(map, 'idle', idleHandler);
    };
  }, [mapLoaded, selectedCategory]);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
  }, []);

  const displayMarkers = useCallback((places: Place[]) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const kakao = window.kakao;

    // 전역 툴팁 요소 생성 (document.body에 추가)
    let globalTooltip = document.getElementById('explore-global-tooltip');
    if (!globalTooltip) {
      globalTooltip = document.createElement('div');
      globalTooltip.id = 'explore-global-tooltip';
      globalTooltip.style.cssText = `
        display: none;
        position: fixed;
        padding: 8px 12px;
        background: rgba(0,0,0,0.9);
        border-radius: 8px;
        white-space: nowrap;
        pointer-events: none;
        z-index: 99999;
        transform: translateX(-50%);
      `;

      const tooltipContent = document.createElement('div');
      tooltipContent.id = 'explore-tooltip-content';

      const tooltipArrow = document.createElement('div');
      tooltipArrow.style.cssText = `
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 6px solid transparent;
        border-right: 6px solid transparent;
        border-top: 6px solid rgba(0,0,0,0.9);
      `;

      globalTooltip.appendChild(tooltipContent);
      globalTooltip.appendChild(tooltipArrow);
      document.body.appendChild(globalTooltip);
    }

    places.forEach((place, idx) => {
      const position = new kakao.maps.LatLng(parseFloat(place.y), parseFloat(place.x));
      const isSelected = selectedPlace?.id === place.id;

      const markerContent = document.createElement('div');
      markerContent.style.cursor = 'pointer';

      const markerEl = document.createElement('div');
      markerEl.style.cssText = `
        width: ${isSelected ? '32px' : '28px'};
        height: ${isSelected ? '32px' : '28px'};
        background: ${isSelected ? '#3B82F6' : '#EF4444'};
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        color: white;
        box-shadow: ${isSelected ? '0 4px 12px rgba(59,130,246,0.5)' : '0 2px 6px rgba(0,0,0,0.3)'};
        transition: all 0.2s ease;
      `;
      markerEl.textContent = String(idx + 1);

      markerContent.appendChild(markerEl);

      const customOverlay = new kakao.maps.CustomOverlay({
        position,
        content: markerContent,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: isSelected ? 10 : 1,
      });

      customOverlay.setMap(map);
      markersRef.current.push(customOverlay);

      // 호버 이벤트 - 전역 툴팁 사용
      markerContent.addEventListener('mouseenter', () => {
        const tooltip = document.getElementById('explore-global-tooltip');
        const tooltipContent = document.getElementById('explore-tooltip-content');
        if (tooltip && tooltipContent) {
          // 거리 포맷팅
          const formatDist = (d: string) => {
            const dist = parseInt(d);
            if (dist >= 1000) return `${(dist / 1000).toFixed(1)}km`;
            return `${dist}m`;
          };

          // 툴팁 내용 업데이트 - 결과 리스트와 동일한 정보
          tooltipContent.innerHTML = `
            <div style="color: white; font-size: 13px; font-weight: 600; margin-bottom: 4px;">${place.place_name}</div>
            ${place.distance ? `<div style="display: inline-block; background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px; font-size: 10px; color: #E5E7EB; margin-bottom: 4px;">${formatDist(place.distance)}</div>` : ''}
            ${place.category_name ? `<div style="color: #9CA3AF; font-size: 11px;">${place.category_name}</div>` : ''}
            <div style="color: #9CA3AF; font-size: 11px; margin-top: 2px;">${place.road_address_name || place.address_name}</div>
            ${place.phone ? `<div style="color: #34D399; font-size: 11px; margin-top: 4px;">📞 ${place.phone}</div>` : ''}
          `;

          // 마커의 화면 좌표 계산
          const rect = markerEl.getBoundingClientRect();
          const tooltipX = rect.left + rect.width / 2;
          const tooltipY = rect.top - 10;

          tooltip.style.left = `${tooltipX}px`;
          tooltip.style.top = `${tooltipY}px`;
          tooltip.style.transform = 'translateX(-50%) translateY(-100%)';
          tooltip.style.display = 'block';
        }

        if (!isSelected) {
          markerEl.style.transform = 'scale(1.15)';
          markerEl.style.boxShadow = '0 4px 12px rgba(239,68,68,0.5)';
        }
      });

      markerContent.addEventListener('mouseleave', () => {
        const tooltip = document.getElementById('explore-global-tooltip');
        if (tooltip) {
          tooltip.style.display = 'none';
        }

        if (!isSelected) {
          markerEl.style.transform = 'scale(1)';
          markerEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        }
      });

      markerContent.onclick = () => {
        setSelectedPlace(place);
        map.setCenter(position);
      };
    });
  }, [selectedPlace]);

  const searchCategory = useCallback((categoryCode: string) => {
    if (!psRef.current || !mapInstanceRef.current) return;

    setLoading(true);
    clearMarkers();
    setSelectedPlace(null);

    psRef.current.categorySearch(
      categoryCode,
      (data: Place[], status: string) => {
        setLoading(false);

        if (status === window.kakao.maps.services.Status.OK) {
          setPlaces(data);
          displayMarkers(data);
          setActiveTab('result');

          if (data.length > 0) {
            const bounds = new window.kakao.maps.LatLngBounds();
            data.forEach((place) => {
              bounds.extend(new window.kakao.maps.LatLng(parseFloat(place.y), parseFloat(place.x)));
            });
            mapInstanceRef.current.setBounds(bounds);
          }
        } else {
          setPlaces([]);
        }
      },
      { useMapBounds: true }
    );
  }, [clearMarkers, displayMarkers]);

  const handleCategorySelect = (categoryCode: string) => {
    if (selectedCategory === categoryCode) {
      setSelectedCategory(null);
      setPlaces([]);
      clearMarkers();
      setSelectedPlace(null);
      setActiveTab('category');
    } else {
      setSelectedCategory(categoryCode);
      searchCategory(categoryCode);
    }
  };

  const moveToCurrentLocation = () => {
    if (!mapInstanceRef.current || !currentLocation) return;

    const position = new window.kakao.maps.LatLng(currentLocation.lat, currentLocation.lng);
    mapInstanceRef.current.setCenter(position);
    mapInstanceRef.current.setLevel(4);

    if (selectedCategory) {
      setTimeout(() => searchCategory(selectedCategory), 300);
    }
  };

  const handlePlaceSelect = (place: Place) => {
    if (!mapInstanceRef.current) return;

    const position = new window.kakao.maps.LatLng(parseFloat(place.y), parseFloat(place.x));
    mapInstanceRef.current.setCenter(position);
    mapInstanceRef.current.setLevel(3);
    setSelectedPlace(place);

    clearMarkers();
    displayMarkers(places);
  };

  const formatDistance = (distance: string) => {
    const d = parseInt(distance);
    if (d >= 1000) {
      return `${(d / 1000).toFixed(1)}km`;
    }
    return `${d}m`;
  };

  // 주소/키워드 검색
  const searchByKeyword = useCallback((query: string) => {
    if (!query.trim() || !psRef.current || !mapInstanceRef.current) return;

    setLoading(true);
    clearMarkers();
    setSelectedPlace(null);
    setSelectedCategory(null);

    // 검색 히스토리에 추가
    setSearchHistory((prev) => {
      const filtered = prev.filter((h) => h !== query);
      return [query, ...filtered].slice(0, 10);
    });

    // 키워드 검색 (장소 검색)
    psRef.current.keywordSearch(
      query,
      (data: Place[], status: string) => {
        if (status === window.kakao.maps.services.Status.OK) {
          setPlaces(data);
          displayMarkers(data);
          setActiveTab('result');
          setLoading(false);

          if (data.length > 0) {
            const bounds = new window.kakao.maps.LatLngBounds();
            data.forEach((place) => {
              bounds.extend(new window.kakao.maps.LatLng(parseFloat(place.y), parseFloat(place.x)));
            });
            mapInstanceRef.current.setBounds(bounds);
          }
        } else if (status === window.kakao.maps.services.Status.ZERO_RESULT) {
          // 키워드 검색 결과가 없으면 주소 검색 시도
          searchByAddress(query);
        } else {
          setPlaces([]);
          setLoading(false);
          setActiveTab('result');
        }
      },
      { size: 15 }
    );
  }, [clearMarkers, displayMarkers]);

  // 주소로 검색
  const searchByAddress = useCallback((query: string) => {
    if (!geocoderRef.current || !mapInstanceRef.current) {
      setLoading(false);
      return;
    }

    geocoderRef.current.addressSearch(query, (result: any[], status: string) => {
      setLoading(false);

      if (status === window.kakao.maps.services.Status.OK && result.length > 0) {
        const firstResult = result[0];
        const position = new window.kakao.maps.LatLng(firstResult.y, firstResult.x);

        // 지도 이동
        mapInstanceRef.current.setCenter(position);
        mapInstanceRef.current.setLevel(3);

        // 마커 표시
        clearMarkers();
        const markerContent = document.createElement('div');
        markerContent.innerHTML = `
          <div style="
            padding: 8px 12px;
            background: #3B82F6;
            border-radius: 20px;
            color: white;
            font-size: 12px;
            font-weight: 600;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            white-space: nowrap;
          ">${firstResult.address_name}</div>
        `;

        const customOverlay = new window.kakao.maps.CustomOverlay({
          position,
          content: markerContent,
          yAnchor: 1.3,
        });
        customOverlay.setMap(mapInstanceRef.current);
        markersRef.current.push(customOverlay);

        // 주변 장소 검색을 위한 place 객체 생성
        const addressPlace: Place = {
          id: 'address-' + Date.now(),
          place_name: firstResult.address_name,
          category_name: '주소',
          category_group_name: '',
          phone: '',
          address_name: firstResult.address?.address_name || firstResult.address_name,
          road_address_name: firstResult.road_address?.address_name || '',
          x: firstResult.x,
          y: firstResult.y,
          place_url: '',
          distance: '',
        };

        setPlaces([addressPlace]);
        setSelectedPlace(addressPlace);
        setActiveTab('result');
      } else {
        setPlaces([]);
        setActiveTab('result');
      }
    });
  }, [clearMarkers]);

  // 검색 폼 제출
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchByKeyword(searchQuery);
  };

  const tabs = [
    { id: 'search' as TabType, label: '검색', icon: '🔍' },
    { id: 'category' as TabType, label: '카테고리', icon: '📂' },
    { id: 'result' as TabType, label: '결과', icon: '📍' },
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* 사이드 패널 */}
      <div
        className={cn(
          "flex-shrink-0 bg-background border-r border-border flex flex-col transition-all duration-300",
          isPanelOpen ? "w-96" : "w-0"
        )}
      >
        {/* 탭 헤더 */}
        <div className="flex-shrink-0 p-3 border-b border-border bg-muted/30">
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent text-muted-foreground"
                )}
              >
                <span className="mr-1">{tab.icon}</span>
                {tab.label}
                {tab.id === 'result' && places.length > 0 && (
                  <span className="ml-1 text-xs">({places.length})</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 탭 내용 */}
        <div className="flex-1 overflow-y-auto">
          {/* 검색 탭 */}
          {activeTab === 'search' && (
            <div className="p-4">
              <form onSubmit={handleSearchSubmit} className="mb-4">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="주소, 장소, 키워드 검색"
                    className="w-full px-4 py-3 pr-12 border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <button
                    type="submit"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-foreground"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </button>
                </div>
              </form>

              {/* 검색 예시 */}
              <div className="mb-6">
                <p className="text-xs text-muted-foreground mb-2">예시</p>
                <div className="flex flex-wrap gap-2">
                  {['강남역', '서울시청', '판교역 카페', '홍대입구'].map((example) => (
                    <button
                      key={example}
                      onClick={() => {
                        setSearchQuery(example);
                        searchByKeyword(example);
                      }}
                      className="px-3 py-1.5 text-xs bg-muted hover:bg-accent rounded-full transition-colors"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>

              {/* 검색 히스토리 */}
              {searchHistory.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-muted-foreground">최근 검색</p>
                    <button
                      onClick={() => setSearchHistory([])}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      전체 삭제
                    </button>
                  </div>
                  <div className="space-y-1">
                    {searchHistory.map((query, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setSearchQuery(query);
                          searchByKeyword(query);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent rounded-lg transition-colors"
                      >
                        <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="truncate">{query}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 검색 안내 */}
              {searchHistory.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    주소나 장소명으로<br />검색해보세요
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 카테고리 탭 */}
          {activeTab === 'category' && (
            <div className="p-4">
              <p className="text-sm text-muted-foreground mb-4">주변 장소를 카테고리별로 검색하세요</p>
              <div className="grid grid-cols-3 gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.code}
                    onClick={() => handleCategorySelect(cat.code)}
                    className={cn(
                      "flex flex-col items-center justify-center p-3 rounded-lg border border-border transition-colors",
                      selectedCategory === cat.code
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-accent"
                    )}
                  >
                    <span className="text-2xl mb-1">{cat.icon}</span>
                    <span className="text-xs font-medium">{cat.name}</span>
                  </button>
                ))}
              </div>

              {/* 검색 안내 */}
              <div className="flex flex-col items-center justify-center py-8 text-center mt-4">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <p className="text-muted-foreground text-sm">
                  카테고리를 선택하면<br />주변 장소가 표시됩니다
                </p>
              </div>
            </div>
          )}

          {/* 검색 결과 탭 */}
          {activeTab === 'result' && (
            <div>
              {loading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm text-muted-foreground">검색 중...</p>
                </div>
              ) : places.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-muted-foreground text-sm mb-2">검색 결과가 없습니다</p>
                  <p className="text-xs text-muted-foreground/70">지도를 이동해서 다시 검색해보세요</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('category')}
                    className="mt-4"
                  >
                    카테고리 선택
                  </Button>
                </div>
              ) : (
                <>
                  <div className="p-3 bg-muted/50 border-b border-border sticky top-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">
                          {CATEGORIES.find(c => c.code === selectedCategory)?.icon}
                        </span>
                        <span className="text-sm font-medium">
                          {CATEGORIES.find(c => c.code === selectedCategory)?.name}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {places.length}개
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => selectedCategory && searchCategory(selectedCategory)}
                      >
                        새로고침
                      </Button>
                    </div>
                  </div>
                  <div>
                    {places.map((place, idx) => (
                      <button
                        key={place.id}
                        onClick={() => handlePlaceSelect(place)}
                        className={cn(
                          "w-full p-4 text-left border-b border-border hover:bg-accent/50 transition-colors",
                          selectedPlace?.id === place.id && "bg-accent"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white",
                            selectedPlace?.id === place.id ? "bg-blue-500" : "bg-red-500"
                          )}>
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-medium text-foreground text-sm">{place.place_name}</h3>
                              {place.distance && (
                                <Badge variant="secondary" className="flex-shrink-0 text-xs">
                                  {formatDistance(place.distance)}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                              {place.category_name}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {place.road_address_name || place.address_name}
                            </p>
                            {place.phone && (
                              <p className="text-xs text-green-600 mt-1">{place.phone}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* 선택된 장소 상세 */}
        {selectedPlace && (
          <div className="flex-shrink-0 p-4 border-t border-border bg-muted/30">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-foreground">{selectedPlace.place_name}</h3>
              <button
                onClick={() => setSelectedPlace(null)}
                className="p-1 hover:bg-accent rounded"
              >
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-1">{selectedPlace.category_name}</p>
            <p className="text-xs text-muted-foreground mb-2">
              {selectedPlace.road_address_name || selectedPlace.address_name}
            </p>
            {selectedPlace.phone && (
              <a href={`tel:${selectedPlace.phone}`} className="text-xs text-green-600 block mb-3">
                {selectedPlace.phone}
              </a>
            )}
            <div className="flex gap-2">
              <a
                href={selectedPlace.place_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="outline" size="sm" className="w-full">
                  상세보기
                </Button>
              </a>
              <a
                href={`https://map.kakao.com/link/to/${selectedPlace.place_name},${selectedPlace.y},${selectedPlace.x}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button size="sm" className="w-full">
                  길찾기
                </Button>
              </a>
            </div>
          </div>
        )}
      </div>

      {/* 지도 영역 */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />

        {/* 패널 토글 버튼 */}
        <button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className="absolute top-4 left-4 z-10 bg-white p-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
        >
          <svg
            className={cn("w-5 h-5 text-gray-600 transition-transform", !isPanelOpen && "rotate-180")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* 현재 위치 버튼 */}
        <button
          onClick={moveToCurrentLocation}
          className="absolute bottom-4 right-4 z-10 w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>

        {/* 줌 컨트롤 */}
        <div className="absolute bottom-16 right-4 z-10 flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
          <button
            onClick={() => mapInstanceRef.current?.setLevel(mapInstanceRef.current.getLevel() - 1)}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors border-b border-gray-200"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={() => mapInstanceRef.current?.setLevel(mapInstanceRef.current.getLevel() + 1)}
            className="w-10 h-10 flex items-center justify-center hover:bg-gray-50 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
        </div>

        {/* 지도 로딩 */}
        {!mapLoaded && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">지도 로딩 중...</span>
            </div>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="flex flex-col items-center gap-2">
              <svg className="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-sm text-muted-foreground">{error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
