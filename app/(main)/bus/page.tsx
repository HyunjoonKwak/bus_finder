'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StationSearchInput } from '@/components/station/StationSearchInput';
import { BusSearchInput } from '@/components/bus/BusSearchInput';
import { SearchForm } from '@/components/search/SearchForm';
import { loadKakaoMapScript, getCurrentPosition } from '@/lib/kakao';
import { cn } from '@/lib/utils';
import type { StationInfo, NearbyStationInfo, BusLaneInfo, BusStationInfo, RealtimeArrivalInfo } from '@/lib/odsay/types';
import { BUS_TYPE_MAP } from '@/lib/odsay/types';
import { createClient } from '@/lib/supabase/client';
import { useSearchStore } from '@/lib/store';

type TabType = 'station' | 'route' | 'search' | 'tracking';

interface FavoriteStation {
  id: string;
  station_id: string;
  station_name: string;
  x?: string;
  y?: string;
}

interface FavoriteRoute {
  id: string;
  bus_id: string;
  bus_no: string;
  bus_type?: number;
}

// 버스 타입별 색상 (서울/경기 통합)
// 경기도 도착정보 API 기준 (routeTypeCd)
// 11:직행좌석형, 12:좌석형, 13:일반형, 14:광역급행형, 15:따복형, 16:경기순환
// 21:직행좌석형농어촌, 22:좌석형농어촌, 23:일반형농어촌, 30:마을버스
// 41:고속형시외, 42:좌석형시외, 43:일반형시외, 51:리무진공항, 52:좌석형공항, 53:일반형공항
const BUS_TYPE_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  // 서울시 버스 타입 (서울시 API routeType)
  1: { bg: 'bg-green-500', text: 'text-white', label: '지선' },
  2: { bg: 'bg-green-600', text: 'text-white', label: '좌석' },
  3: { bg: 'bg-emerald-500', text: 'text-white', label: '마을' },
  4: { bg: 'bg-red-500', text: 'text-white', label: '광역' },
  5: { bg: 'bg-sky-500', text: 'text-white', label: '공항' },
  6: { bg: 'bg-blue-600', text: 'text-white', label: '간선' },
  // 경기도 시내버스 (routeTypeCd)
  11: { bg: 'bg-red-500', text: 'text-white', label: '직행좌석' },
  12: { bg: 'bg-green-600', text: 'text-white', label: '좌석' },
  13: { bg: 'bg-green-500', text: 'text-white', label: '일반' },
  14: { bg: 'bg-red-600', text: 'text-white', label: '광역급행' },
  15: { bg: 'bg-purple-500', text: 'text-white', label: '따복' },
  16: { bg: 'bg-blue-600', text: 'text-white', label: '경기순환' },
  17: { bg: 'bg-red-500', text: 'text-white', label: '직행좌석' },
  // 경기도 농어촌버스
  21: { bg: 'bg-red-500', text: 'text-white', label: '직행좌석' },
  22: { bg: 'bg-green-600', text: 'text-white', label: '좌석' },
  23: { bg: 'bg-green-500', text: 'text-white', label: '일반' },
  // 마을버스
  30: { bg: 'bg-emerald-500', text: 'text-white', label: '마을' },
  // 시외버스
  41: { bg: 'bg-purple-600', text: 'text-white', label: '고속' },
  42: { bg: 'bg-purple-500', text: 'text-white', label: '좌석시외' },
  43: { bg: 'bg-purple-500', text: 'text-white', label: '일반시외' },
  // 공항버스
  51: { bg: 'bg-sky-600', text: 'text-white', label: '리무진' },
  52: { bg: 'bg-sky-500', text: 'text-white', label: '좌석공항' },
  53: { bg: 'bg-sky-500', text: 'text-white', label: '일반공항' },
};

// 혼잡도 표시
const getCrowdedInfo = (crowded?: number) => {
  if (!crowded) return null;
  const info: Record<number, { label: string; color: string; icon: string }> = {
    1: { label: '여유', color: 'text-green-500', icon: '🟢' },
    2: { label: '보통', color: 'text-yellow-500', icon: '🟡' },
    3: { label: '혼잡', color: 'text-orange-500', icon: '🟠' },
    4: { label: '매우혼잡', color: 'text-red-500', icon: '🔴' },
  };
  return info[crowded] || null;
};

// 버스 타입 색상 가져오기
const getBusTypeStyle = (type?: number) => {
  if (!type) return { bg: 'bg-blue-500', text: 'text-white', label: '버스' };
  return BUS_TYPE_COLORS[type] || { bg: 'bg-blue-500', text: 'text-white', label: BUS_TYPE_MAP[type] || '버스' };
};

// 원형 카운트다운 프로그래스 컴포넌트
const CircularCountdown = ({ duration = 10, size = 20, strokeWidth = 2 }: { duration?: number; size?: number; strokeWidth?: number }) => {
  const [startTime, setStartTime] = useState(Date.now());
  const [progress, setProgress] = useState(100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      const cycleElapsed = elapsed % duration; // 주기 내 경과 시간
      const remaining = Math.max(0, 100 - (cycleElapsed / duration) * 100);
      setProgress(remaining);
    }, 50);

    return () => clearInterval(interval);
  }, [duration, startTime]);

  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* 배경 원 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted-foreground/20"
      />
      {/* 프로그래스 원 */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        className="text-green-500 transition-all duration-100"
      />
    </svg>
  );
};

interface TrackingTarget {
  id: string;
  bus_id: string;
  bus_no: string;
  station_id: string;
  station_name: string;
  ars_id?: string; // 정류소 고유번호 (도착 정보 조회용)
  is_active: boolean;
}

interface TrackingTargetWithArrival extends TrackingTarget {
  arrival?: {
    arrivalSec: number;
    leftStation: number;
  };
  lastChecked?: Date;
}

interface NearbyStation {
  stationID: string;
  stationName: string;
  x: string;
  y: string;
  distance: number;
  arsID?: string;
}

interface SearchHistoryItem {
  type: 'station' | 'bus';
  id: string;
  name: string;
  subInfo?: string;
  x?: string;
  y?: string;
  arsID?: string;
  timestamp: number;
}

// 길찾기 관련 인터페이스
interface RouteLeg {
  mode: string;
  duration: number;
  routeName?: string;
  routeId?: string;
  startName: string;
  endName: string;
  stationCount?: number;
  distance?: number;
}

interface RouteResult {
  id: string;
  origin: { name: string; x?: number; y?: number };
  destination: { name: string; x?: number; y?: number };
  totalTime: number;
  totalDistance?: number;
  walkTime: number;
  transferCount: number;
  fare: number;
  legs: RouteLeg[];
  pathType?: number;
}

interface SearchResponse {
  routes: RouteResult[];
  matchedOrigin?: string;
  matchedDest?: string;
  error?: string;
}

function BusPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const radiusCircleRef = useRef<any>(null);
  const centerMarkerRef = useRef<any>(null);

  // URL 파라미터에서 탭 초기값 가져오기
  const tabParam = searchParams.get('tab') as TabType | null;
  const initialTab = tabParam && ['station', 'route', 'search', 'tracking'].includes(tabParam) ? tabParam : 'station';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [trackingTargets, setTrackingTargets] = useState<TrackingTargetWithArrival[]>([]);
  const [nearbyStations, setNearbyStations] = useState<NearbyStation[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [searchRadius, setSearchRadius] = useState(500);
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // 사용자 지도 조작 감지용
  const [userMovedMap, setUserMovedMap] = useState(false);
  const isInitialLoadRef = useRef(true);

  // 정류소 검색/선택 상태
  const [selectedStation, setSelectedStation] = useState<StationInfo | null>(null);
  const [stationArrivals, setStationArrivals] = useState<RealtimeArrivalInfo[]>([]);
  const [loadingArrivals, setLoadingArrivals] = useState(false);

  // 노선 검색/선택 상태
  const [selectedBus, setSelectedBus] = useState<BusLaneInfo | null>(null);
  const [busRouteStations, setBusRouteStations] = useState<BusStationInfo[]>([]);
  const [busPositions, setBusPositions] = useState<any[]>([]);
  const [loadingBusRoute, setLoadingBusRoute] = useState(false);
  const busMarkersRef = useRef<any[]>([]);

  // 검색 히스토리
  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);

  // 사용자 인증 상태
  const [user, setUser] = useState<{ id: string } | null>(null);

  // 즐겨찾기 상태
  const [favoriteStations, setFavoriteStations] = useState<FavoriteStation[]>([]);
  const [favoriteRoutes, setFavoriteRoutes] = useState<FavoriteRoute[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);

  // 현재 정류소에서 추적 중인 버스 ID 목록
  const [stationTrackingBusIds, setStationTrackingBusIds] = useState<string[]>([]);

  // 추적 탭 도착 정보 갱신용
  const [trackingCountdown, setTrackingCountdown] = useState(30);
  const [checkingTrackingArrivals, setCheckingTrackingArrivals] = useState(false);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 정류소 탭 도착 정보 자동 갱신용
  const [stationCountdown, setStationCountdown] = useState(15);
  const stationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 자동 도착 기록용 (최근 기록한 버스 ID 추적 - 중복 방지)
  const recentlyLoggedRef = useRef<Map<string, number>>(new Map());
  const AUTO_LOG_THRESHOLD = 180; // 3분 이내면 자동 기록 (30초 폴링 간격 고려)

  // 길찾기 관련 상태
  const { recentSearches } = useSearchStore();
  const [routeSearchOrigin, setRouteSearchOrigin] = useState<string | null>(null);
  const [routeSearchDest, setRouteSearchDest] = useState<string | null>(null);
  const [routeSearchParams, setRouteSearchParams] = useState<{ sx?: string; sy?: string; ex?: string; ey?: string }>({});
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [matchedPlaces, setMatchedPlaces] = useState<{ origin?: string; dest?: string }>({});
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<RouteResult | null>(null);

  // 히스토리 로드
  useEffect(() => {
    const saved = localStorage.getItem('bus_search_history');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch {
        setSearchHistory([]);
      }
    }
  }, []);

  // 히스토리 저장
  const addToHistory = useCallback((item: Omit<SearchHistoryItem, 'timestamp'>) => {
    setSearchHistory((prev) => {
      // 중복 제거 후 앞에 추가
      const filtered = prev.filter((h) => !(h.type === item.type && h.id === item.id));
      const newHistory = [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, 20);
      localStorage.setItem('bus_search_history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

  // 사용자 인증 체크
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  // 현재 정류소의 추적 대상 조회
  const fetchStationTrackingTargets = useCallback(async (stationId: string) => {
    if (!user) return;
    try {
      const response = await fetch('/api/tracking/targets');
      const data = await response.json();
      const targets = data.targets || [];
      const busIds = targets
        .filter((t: TrackingTarget) => t.station_id === stationId)
        .map((t: TrackingTarget) => t.bus_id);
      setStationTrackingBusIds(busIds);
    } catch (error) {
      console.error('Fetch station tracking targets error:', error);
    }
  }, [user]);

  // 추적 토글 (정류소 탭에서 사용)
  const toggleStationTracking = async (busId: string, busNo: string) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!selectedStation) return;

    const isTracking = stationTrackingBusIds.includes(busId);

    try {
      if (isTracking) {
        // 추적 대상에서 제거
        const response = await fetch('/api/tracking/targets');
        const data = await response.json();
        const target = data.targets?.find(
          (t: TrackingTarget) => t.bus_id === busId && t.station_id === selectedStation.stationID
        );
        if (target) {
          await fetch(`/api/tracking/targets?id=${target.id}`, { method: 'DELETE' });
        }
      } else {
        // 추적 대상에 추가 (arsId 포함 - 도착 정보 조회에 필요)
        await fetch('/api/tracking/targets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bus_id: busId,
            bus_no: busNo,
            station_id: selectedStation.stationID,
            station_name: selectedStation.stationName,
            ars_id: selectedStation.arsID || null,
          }),
        });
      }
      // 상태 갱신
      await fetchStationTrackingTargets(selectedStation.stationID);
      // 추적 대상 목록도 갱신
      await fetchTrackingTargets();
    } catch (error) {
      console.error('Toggle tracking error:', error);
    }
  };

  // 도착 기록 함수
  // arrivalSec: 도착까지 남은 초 (자동 기록 시 전달, 수동 기록 시 undefined)
  const logArrival = async (target: TrackingTarget, arrivalSec?: number): Promise<{ success: boolean; error?: string }> => {
    try {
      // 예상 도착 시간 계산: 현재 시간 + 남은 초
      const arrivalTime = arrivalSec
        ? new Date(Date.now() + arrivalSec * 1000).toISOString()
        : new Date().toISOString(); // 수동 기록은 현재 시간

      const response = await fetch('/api/tracking/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bus_id: target.bus_id,
          bus_no: target.bus_no,
          station_id: target.station_id,
          station_name: target.station_name,
          arrival_time: arrivalTime,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // 중복 방지를 위해 기록
        const key = `${target.bus_id}-${target.station_id}`;
        recentlyLoggedRef.current.set(key, Date.now());
        console.log(`Arrival logged successfully: ${target.bus_no} @ ${target.station_name}`);
        return { success: true };
      }
      console.error('Log arrival API error:', response.status, data.error);
      return { success: false, error: data.error || '알 수 없는 오류' };
    } catch (error) {
      console.error('Log arrival error:', error);
      return { success: false, error: '네트워크 오류' };
    }
  };

  // 자동 도착 기록 체크
  const shouldAutoLog = (target: TrackingTarget): boolean => {
    const key = `${target.bus_id}-${target.station_id}`;
    const lastLogged = recentlyLoggedRef.current.get(key);

    // 5분 이내에 기록한 적이 있으면 스킵
    if (lastLogged && Date.now() - lastLogged < 5 * 60 * 1000) {
      return false;
    }
    return true;
  };

  // 추적 탭 도착 정보 조회 (자동 기록 포함)
  const checkTrackingArrivals = useCallback(async () => {
    if (trackingTargets.length === 0) return;

    setCheckingTrackingArrivals(true);
    const activeTargets = trackingTargets.filter((t) => t.is_active);

    // 정류소별로 그룹화 (arsId 포함)
    const stationMap = new Map<string, { targets: TrackingTargetWithArrival[]; arsId?: string }>();
    for (const target of activeTargets) {
      const existing = stationMap.get(target.station_id) || { targets: [], arsId: target.ars_id };
      existing.targets.push(target);
      // arsId가 있는 target에서 가져오기
      if (target.ars_id && !existing.arsId) {
        existing.arsId = target.ars_id;
      }
      stationMap.set(target.station_id, existing);
    }

    const updatedTargets = [...trackingTargets];

    for (const [stationId, { targets: stationTargets, arsId }] of stationMap) {
      try {
        // arsId가 있으면 함께 전달 (서울시/경기도 API 정확한 조회를 위해)
        const params = new URLSearchParams({ stationId });
        if (arsId) params.append('arsId', arsId);
        const apiUrl = `/api/bus/arrival?${params.toString()}`;
        console.log(`[Tracking] Fetching arrivals from: ${apiUrl}`);
        const response = await fetch(apiUrl);
        const data = await response.json();
        const arrivals = data.arrivals || [];
        console.log(`[Tracking] Got ${arrivals.length} arrivals for station ${stationId}`);

        for (const target of stationTargets) {
          // 버스 매칭: routeId 또는 routeName으로 비교 (타입 변환 포함)
          const busArrival = arrivals.find((a: any) => {
            const aRouteId = String(a.routeId || '');
            const aRouteName = String(a.routeName || '');
            const tBusId = String(target.bus_id || '');
            const tBusNo = String(target.bus_no || '');

            return (
              aRouteId === tBusId ||
              aRouteName === tBusNo ||
              aRouteName.replace(/\s/g, '') === tBusNo.replace(/\s/g, '')
            );
          });

          // 디버그 로그
          if (arrivals.length > 0 && !busArrival) {
            console.log(`[Tracking] No match for bus ${target.bus_no} (id: ${target.bus_id}) at station ${target.station_id}`);
            console.log(`[Tracking] Available arrivals:`, arrivals.map((a: any) => ({ routeId: String(a.routeId || ''), routeName: String(a.routeName || '') })));
          }

          const targetIndex = updatedTargets.findIndex((t) => t.id === target.id);
          if (targetIndex >= 0) {
            const arrivalSec = busArrival?.predictTimeSec1;
            updatedTargets[targetIndex] = {
              ...updatedTargets[targetIndex],
              arrival: arrivalSec ? {
                arrivalSec,
                leftStation: busArrival.locationNo1 || 0,
              } : undefined,
              lastChecked: new Date(),
            };

            // 자동 도착 기록: 3분 이내이고 최근에 기록한 적이 없으면
            if (arrivalSec) {
              console.log(`[Tracking] ${target.bus_no}: ${arrivalSec}초 남음 (threshold: ${AUTO_LOG_THRESHOLD}초)`);
              if (arrivalSec <= AUTO_LOG_THRESHOLD) {
                const canLog = shouldAutoLog(target);
                console.log(`[Tracking] Can auto-log: ${canLog}`);
                if (canLog) {
                  console.log(`[Tracking] Auto-logging arrival: ${target.bus_no} @ ${target.station_name} (예상 도착: ${arrivalSec}초 후)`);
                  // arrivalSec를 전달하여 예상 도착 시간으로 기록
                  logArrival(target, arrivalSec);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Station ${stationId} fetch error:`, error);
      }
    }

    setTrackingTargets(updatedTargets);
    setCheckingTrackingArrivals(false);
  }, [trackingTargets]);

  // 추적 대상 토글 (활성/비활성)
  const handleTrackingToggle = async (target: TrackingTarget) => {
    try {
      await fetch('/api/tracking/targets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target.id, is_active: !target.is_active }),
      });
      fetchTrackingTargets();
    } catch (error) {
      console.error('Toggle target error:', error);
    }
  };

  // 추적 대상 삭제
  const handleTrackingDelete = async (id: string) => {
    if (!confirm('이 추적 대상을 삭제하시겠습니까?')) return;
    try {
      await fetch(`/api/tracking/targets?id=${id}`, { method: 'DELETE' });
      fetchTrackingTargets();
    } catch (error) {
      console.error('Delete target error:', error);
    }
  };

  // 통계 보기
  const handleViewStats = (target: TrackingTarget) => {
    router.push(
      `/tracking/stats?bus_id=${target.bus_id}&station_id=${target.station_id}&bus_no=${encodeURIComponent(target.bus_no)}&station_name=${encodeURIComponent(target.station_name)}`
    );
  };

  // 수동 도착 기록
  const handleManualLogArrival = async (target: TrackingTarget) => {
    const result = await logArrival(target);
    if (result.success) {
      alert(`${target.bus_no}번 버스 도착 시간이 기록되었습니다.\n통계 페이지에서 확인할 수 있습니다.`);
    } else {
      alert(`도착 기록 실패: ${result.error}\n(로그인 상태를 확인해주세요)`);
    }
  };

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
          console.log('현재 위치를 가져올 수 없습니다.');
        }

        setCurrentLocation({ lat, lng });
        setMapCenter({ lat, lng });

        if (!mapRef.current) return;

        const kakao = window.kakao;
        const map = new kakao.maps.Map(mapRef.current, {
          center: new kakao.maps.LatLng(lat, lng),
          level: 4,
        });
        mapInstanceRef.current = map;

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

        // 사용자가 지도를 드래그했을 때만 검색 트리거
        kakao.maps.event.addListener(map, 'dragend', () => {
          const center = map.getCenter();
          setMapCenter({
            lat: center.getLat(),
            lng: center.getLng(),
          });
          setUserMovedMap(true);
        });

        setMapLoaded(true);
      } catch (err) {
        console.error('Map init error:', err);
      }
    }

    initMap();
  }, []);

  // 추적 대상 로드
  useEffect(() => {
    if (activeTab === 'tracking') {
      fetchTrackingTargets();
    }
  }, [activeTab]);

  // 추적 탭 도착 정보 자동 갱신 (30초 간격)
  useEffect(() => {
    if (activeTab !== 'tracking' || trackingTargets.length === 0) {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
        trackingIntervalRef.current = null;
      }
      return;
    }

    // 초기 로드
    checkTrackingArrivals();

    trackingIntervalRef.current = setInterval(() => {
      setTrackingCountdown((prev) => {
        if (prev <= 1) {
          checkTrackingArrivals();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (trackingIntervalRef.current) {
        clearInterval(trackingIntervalRef.current);
      }
    };
  }, [activeTab, trackingTargets.length]);

  // 정류소/노선 탭에서 즐겨찾기 데이터 로드
  useEffect(() => {
    if ((activeTab === 'station' || activeTab === 'route') && user) {
      fetchFavorites();
    }
  }, [activeTab, user]);

  // 정류소 탭 진입 시 주변 정류소 검색 (위치 기반)
  useEffect(() => {
    if (activeTab === 'station' && mapCenter && isInitialLoadRef.current && !selectedStation) {
      isInitialLoadRef.current = false;
      fetchNearbyStations();
    }
  }, [activeTab, mapCenter, selectedStation]);

  // 사용자가 지도를 조작했을 때 검색 (드래그, 줌 변경)
  useEffect(() => {
    if (activeTab === 'station' && userMovedMap && mapCenter && !selectedStation) {
      setUserMovedMap(false);
      fetchNearbyStations();
    }
  }, [activeTab, userMovedMap, mapCenter, selectedStation]);

  // 반경 변경 시 검색
  useEffect(() => {
    if (activeTab === 'station' && mapCenter && !isInitialLoadRef.current && !selectedStation) {
      fetchNearbyStations();
    }
  }, [searchRadius]);

  // 정류소 탭 도착 정보 자동 갱신 (15초 간격)
  useEffect(() => {
    if (activeTab !== 'station' || !selectedStation) {
      if (stationIntervalRef.current) {
        clearInterval(stationIntervalRef.current);
        stationIntervalRef.current = null;
      }
      return;
    }

    // 카운트다운 리셋
    setStationCountdown(15);

    stationIntervalRef.current = setInterval(() => {
      setStationCountdown((prev) => {
        if (prev <= 1) {
          // 도착 정보 새로고침
          fetchStationArrivals(selectedStation.stationID, selectedStation.arsID);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (stationIntervalRef.current) {
        clearInterval(stationIntervalRef.current);
      }
    };
  }, [activeTab, selectedStation?.stationID]);

  // 노선 탭 자동 갱신 (10초 간격)
  useEffect(() => {
    if (activeTab !== 'route' || !selectedBus) return;

    const refreshBusPositions = async () => {
      try {
        const response = await fetch(`/api/bus/route?routeId=${selectedBus.busID}&busNo=${encodeURIComponent(selectedBus.busNo)}`);
        const data = await response.json();
        const realtime = data.realtime || [];
        setBusPositions(realtime);
        // 지도에 버스 위치만 업데이트 (축척 유지)
        if (busRouteStations.length > 0) {
          updateBusMarkers(busRouteStations, realtime);
        }
      } catch (error) {
        console.error('Bus position refresh error:', error);
      }
    };

    const intervalId = setInterval(refreshBusPositions, 10000); // 10초 간격

    return () => clearInterval(intervalId);
  }, [activeTab, selectedBus, busRouteStations]);

  const fetchTrackingTargets = async () => {
    setLoadingTracking(true);
    try {
      const response = await fetch('/api/tracking/targets');
      const data = await response.json();
      setTrackingTargets(data.targets || []);
    } catch (error) {
      console.error('Fetch tracking targets error:', error);
    } finally {
      setLoadingTracking(false);
    }
  };

  const fetchFavorites = async () => {
    setLoadingFavorites(true);
    try {
      const [stationsRes, routesRes] = await Promise.all([
        fetch('/api/favorites/stations'),
        fetch('/api/favorites/routes'),
      ]);
      const stationsData = await stationsRes.json();
      const routesData = await routesRes.json();
      setFavoriteStations(stationsData.stations || []);
      setFavoriteRoutes(routesData.routes || []);
    } catch (error) {
      console.error('Fetch favorites error:', error);
    } finally {
      setLoadingFavorites(false);
    }
  };

  const addFavoriteStation = async (station: StationInfo) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    try {
      const response = await fetch('/api/favorites/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          station_id: station.stationID,
          station_name: station.stationName,
          x: station.x,
          y: station.y,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setFavoriteStations([...favoriteStations, data.station]);
      }
    } catch (error) {
      console.error('Add favorite station error:', error);
    }
  };

  const removeFavoriteStation = async (stationId: string) => {
    try {
      await fetch(`/api/favorites/stations?stationId=${stationId}`, { method: 'DELETE' });
      setFavoriteStations(favoriteStations.filter((s) => s.station_id !== stationId));
    } catch (error) {
      console.error('Remove favorite station error:', error);
    }
  };

  const addFavoriteRoute = async (bus: BusLaneInfo) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    try {
      const response = await fetch('/api/favorites/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bus_id: bus.busID,
          bus_no: bus.busNo,
          bus_type: bus.type, // 버스 타입도 저장
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setFavoriteRoutes([...favoriteRoutes, data.route]);
      }
    } catch (error) {
      console.error('Add favorite route error:', error);
    }
  };

  const removeFavoriteRoute = async (busId: string) => {
    try {
      await fetch(`/api/favorites/routes?busId=${busId}`, { method: 'DELETE' });
      setFavoriteRoutes(favoriteRoutes.filter((r) => r.bus_id !== busId));
    } catch (error) {
      console.error('Remove favorite route error:', error);
    }
  };

  // 즐겨찾기 여부 확인
  const isStationFavorite = (stationId: string) => {
    return favoriteStations.some((s) => s.station_id === stationId);
  };

  const isRouteFavorite = (busId: string) => {
    return favoriteRoutes.some((r) => r.bus_id === busId);
  };

  const fetchNearbyStations = useCallback(async (center?: { lat: number; lng: number }, radius?: number) => {
    const searchCenter = center || mapCenter || currentLocation;
    const searchRadiusValue = radius || searchRadius;

    if (!searchCenter) return;

    setLoadingNearby(true);
    try {
      // 공공데이터포털 API 사용
      const response = await fetch(
        `/api/bus/station/nearby?x=${searchCenter.lng}&y=${searchCenter.lat}&radius=${searchRadiusValue}`
      );
      const data = await response.json();
      const stations = data.stations || [];
      setNearbyStations(stations);
      displayNearbyStationMarkers(stations, searchCenter);
    } catch (error) {
      console.error('Fetch nearby stations error:', error);
    } finally {
      setLoadingNearby(false);
    }
  }, [mapCenter, currentLocation, searchRadius]);

  // 정류소 도착 정보 가져오기 (공공데이터포털 API 사용)
  const fetchStationArrivals = async (stationId: string, arsId?: string) => {
    if (!stationId && !arsId) {
      console.error('stationId or arsId is required');
      return;
    }

    setLoadingArrivals(true);
    setStationArrivals([]);

    try {
      // 공공데이터포털 API 사용 - arsId가 있으면 서울시/경기도 API 자동 판단
      const params = new URLSearchParams();
      if (stationId) params.append('stationId', stationId);
      if (arsId) params.append('arsId', arsId);

      const response = await fetch(`/api/bus/arrival?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }
      const data = await response.json();

      // 공공데이터포털 API 응답을 RealtimeArrivalInfo 형식으로 변환
      const arrivals: RealtimeArrivalInfo[] = (data.arrivals || []).map((item: any) => ({
        routeID: item.routeId || '',
        routeNm: item.routeName,
        routeType: item.routeType,
        arrival1: item.predictTimeSec1 ? {
          arrivalSec: item.predictTimeSec1,
          leftStation: item.locationNo1 || 0,
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

      setStationArrivals(arrivals);

      // 현재 정류소의 추적 대상도 조회
      if (user && stationId) {
        fetchStationTrackingTargets(stationId);
      }
    } catch (error) {
      console.error('Fetch arrivals error:', error);
      setStationArrivals([]);
    } finally {
      setLoadingArrivals(false);
    }
  };

  // 주변 정류소 마커 표시 (지도 위치/축척 변경 없음)
  const displayNearbyStationMarkers = (stations: NearbyStation[], searchCenter?: { lat: number; lng: number }) => {
    if (!mapInstanceRef.current) return;

    const kakao = window.kakao;
    const map = mapInstanceRef.current;

    // 기존 정류소 마커만 제거 (반경 원과 중심 마커는 유지)
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // 검색 중심점
    const center = searchCenter || mapCenter || currentLocation;
    if (center) {
      // 기존 반경 원 제거
      if (radiusCircleRef.current) {
        radiusCircleRef.current.setMap(null);
      }
      // 기존 중심 마커 제거
      if (centerMarkerRef.current) {
        centerMarkerRef.current.setMap(null);
      }

      const centerPosition = new kakao.maps.LatLng(center.lat, center.lng);

      // 반경 원 표시
      const circle = new kakao.maps.Circle({
        center: centerPosition,
        radius: searchRadius,
        strokeWeight: 2,
        strokeColor: '#3B82F6',
        strokeOpacity: 0.8,
        strokeStyle: 'dashed',
        fillColor: '#3B82F6',
        fillOpacity: 0.1,
      });
      circle.setMap(map);
      radiusCircleRef.current = circle;

      // 중심점 마커 표시
      const centerContent = document.createElement('div');
      centerContent.innerHTML = `
        <div style="
          width: 12px;
          height: 12px;
          background: #3B82F6;
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>
      `;
      const centerOverlay = new kakao.maps.CustomOverlay({
        position: centerPosition,
        content: centerContent,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: 10,
      });
      centerOverlay.setMap(map);
      centerMarkerRef.current = centerOverlay;
    }

    // 전역 툴팁 요소 생성 (document.body에 추가)
    let globalTooltip = document.getElementById('station-global-tooltip');
    if (!globalTooltip) {
      globalTooltip = document.createElement('div');
      globalTooltip.id = 'station-global-tooltip';
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
      tooltipContent.id = 'station-tooltip-content';

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

    // 정류소 마커 표시
    stations.forEach((station, idx) => {
      const position = new kakao.maps.LatLng(parseFloat(station.y), parseFloat(station.x));
      const isSelected = selectedStation?.stationID === station.stationID;
      const arsId = station.arsID || '번호없음';

      // 마커 컨테이너 (DOM 요소로 직접 생성)
      const container = document.createElement('div');
      container.style.position = 'relative';
      container.style.cursor = 'pointer';

      // 마커 원형
      const markerEl = document.createElement('div');
      markerEl.className = 'station-marker-circle';
      markerEl.style.cssText = `
        width: ${isSelected ? '40px' : '32px'};
        height: ${isSelected ? '40px' : '32px'};
        background: ${isSelected ? '#3B82F6' : '#10B981'};
        border: ${isSelected ? '3px' : '2px'} solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: ${isSelected ? '14px' : '12px'};
        font-weight: bold;
        color: white;
        box-shadow: ${isSelected ? '0 4px 12px rgba(59,130,246,0.5)' : '0 2px 6px rgba(0,0,0,0.3)'};
        transition: all 0.2s ease;
      `;
      markerEl.textContent = String(idx + 1);

      container.appendChild(markerEl);

      const overlay = new kakao.maps.CustomOverlay({
        position,
        content: container,
        yAnchor: 0.5,
        xAnchor: 0.5,
        zIndex: isSelected ? 10 : 1,
      });

      overlay.setMap(map);
      markersRef.current.push(overlay);

      // 호버 이벤트 - 전역 툴팁 사용
      container.addEventListener('mouseenter', (e) => {
        const tooltip = document.getElementById('station-global-tooltip');
        const tooltipContent = document.getElementById('station-tooltip-content');
        if (tooltip && tooltipContent) {
          // 거리 정보 (있는 경우)
          const distance = station.distance ? Math.round(station.distance) : null;

          // 툴팁 내용 업데이트 - 결과 리스트와 동일한 정보
          tooltipContent.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <div style="color: white; font-size: 13px; font-weight: 600;">${station.stationName}</div>
              ${distance ? `<div style="background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 4px; font-size: 10px; color: #E5E7EB;">${distance}m</div>` : ''}
            </div>
            ${arsId !== '번호없음' ? `<div style="color: #9CA3AF; font-size: 11px;">정류소 번호: ${arsId}</div>` : ''}
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
          markerEl.style.boxShadow = '0 4px 12px rgba(16,185,129,0.5)';
        }
      });

      container.addEventListener('mouseleave', () => {
        const tooltip = document.getElementById('station-global-tooltip');
        if (tooltip) {
          tooltip.style.display = 'none';
        }

        if (!isSelected) {
          markerEl.style.transform = 'scale(1)';
          markerEl.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
        }
      });

      // 클릭 이벤트 - 주변 정류소 유지하면서 선택
      container.addEventListener('click', () => {
        handleSelectStationKeepNearby(station);
      });
    });
    // 지도 위치/축척은 변경하지 않음
  };

  // 마커/폴리라인 초기화
  const clearMapOverlays = () => {
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
      polylineRef.current = null;
    }
    if (radiusCircleRef.current) {
      radiusCircleRef.current.setMap(null);
      radiusCircleRef.current = null;
    }
    if (centerMarkerRef.current) {
      centerMarkerRef.current.setMap(null);
      centerMarkerRef.current = null;
    }
  };

  // 경로 검색 함수
  const fetchRoutes = useCallback(async (origin: string, dest: string, params?: { sx?: string; sy?: string; ex?: string; ey?: string }) => {
    setLoadingRoutes(true);
    setRouteError(null);

    try {
      let url = `/api/search?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(dest)}`;
      if (params?.sx && params?.sy) url += `&sx=${params.sx}&sy=${params.sy}`;
      if (params?.ex && params?.ey) url += `&ex=${params.ex}&ey=${params.ey}`;

      const response = await fetch(url);
      const data: SearchResponse = await response.json();

      if (!response.ok) {
        setRouteError(data.error || '경로 검색에 실패했습니다.');
        return;
      }

      setRoutes(data.routes || []);
      setMatchedPlaces({
        origin: data.matchedOrigin,
        dest: data.matchedDest,
      });

      if (data.routes && data.routes.length > 0) {
        setSelectedRoute(data.routes[0]);
      }
    } catch (err) {
      setRouteError('경로 검색 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoadingRoutes(false);
    }
  }, []);

  // SearchForm에서 검색 실행 시 호출되는 핸들러
  const handleRouteSearch = useCallback((origin: string, dest: string, params?: { sx?: string; sy?: string; ex?: string; ey?: string }) => {
    setRouteSearchOrigin(origin);
    setRouteSearchDest(dest);
    setRouteSearchParams(params || {});
    fetchRoutes(origin, dest, params);
  }, [fetchRoutes]);

  // 최근 검색에서 선택 시
  const handleRecentRouteSearch = useCallback((search: { origin: string; destination: string }) => {
    handleRouteSearch(search.origin, search.destination);
  }, [handleRouteSearch]);

  // 경로 선택
  const handleRouteSelect = useCallback((route: RouteResult) => {
    setSelectedRoute(route);
  }, []);

  // 단일 정류소 마커 표시
  const displaySingleStationMarker = (station: { stationName: string; x: string; y: string }) => {
    if (!mapInstanceRef.current || !station.x || !station.y) return;

    const kakao = window.kakao;
    const map = mapInstanceRef.current;

    clearMapOverlays();

    const position = new kakao.maps.LatLng(parseFloat(station.y), parseFloat(station.x));

    const markerContent = document.createElement('div');
    markerContent.innerHTML = `
      <div style="
        padding: 8px 12px;
        background: #3B82F6;
        border-radius: 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        white-space: nowrap;
      ">
        <span style="color: white; font-size: 13px; font-weight: 600;">🚏 ${station.stationName}</span>
      </div>
      <div style="
        width: 12px;
        height: 12px;
        background: #3B82F6;
        border: 2px solid white;
        border-radius: 50%;
        margin: 4px auto 0;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      "></div>
    `;

    const overlay = new kakao.maps.CustomOverlay({
      position,
      content: markerContent,
      yAnchor: 1.5,
    });
    overlay.setMap(map);
    markersRef.current.push(overlay);

    map.setCenter(position);
    map.setLevel(3);
  };

  // 정류소 선택 (검색 또는 주변에서)
  const handleSelectStation = (station: StationInfo | NearbyStationInfo | NearbyStation) => {
    // arsID 추출 (다양한 소스에서 올 수 있음)
    const arsID = (station as any).arsID || (station as any).arsId || undefined;

    const stationInfo: StationInfo = {
      stationID: station.stationID,
      stationName: station.stationName,
      x: station.x,
      y: station.y,
      CID: 1,
      arsID,
    };

    // 상태 업데이트
    setSelectedStation(stationInfo);
    setSelectedBus(null);
    setBusRouteStations([]);

    // 정류소 탭으로 이동
    setActiveTab('station');

    // 히스토리 추가
    addToHistory({
      type: 'station',
      id: station.stationID,
      name: station.stationName,
      x: station.x,
      y: station.y,
      arsID: stationInfo.arsID,
    });

    // 지도에 마커 표시
    displaySingleStationMarker({
      stationName: station.stationName,
      x: station.x,
      y: station.y,
    });

    // 도착 정보 가져오기 (arsId가 있으면 함께 전달)
    fetchStationArrivals(station.stationID, stationInfo.arsID);
  };

  // 정류소 선택 (주변 정류소 유지) - 지도 마커에서 사용
  const handleSelectStationKeepNearby = (station: NearbyStation) => {
    // arsID 추출
    const arsID = (station as any).arsID || (station as any).arsId || undefined;

    const stationInfo: StationInfo = {
      stationID: station.stationID,
      stationName: station.stationName,
      x: station.x,
      y: station.y,
      CID: 1,
      arsID,
    };

    // 상태 업데이트
    setSelectedStation(stationInfo);
    setSelectedBus(null);
    setBusRouteStations([]);

    // 히스토리 추가
    addToHistory({
      type: 'station',
      id: station.stationID,
      name: station.stationName,
      x: station.x,
      y: station.y,
      arsID: stationInfo.arsID,
    });

    // 주변 정류소 마커 다시 표시 (선택된 정류소 강조)
    if (nearbyStations.length > 0) {
      displayNearbyStationMarkers(nearbyStations);
    }

    // 지도 중심을 선택한 정류소로 이동 (부드럽게)
    if (mapInstanceRef.current) {
      const kakao = window.kakao;
      const position = new kakao.maps.LatLng(parseFloat(station.y), parseFloat(station.x));
      mapInstanceRef.current.panTo(position);
    }

    // 도착 정보 가져오기
    fetchStationArrivals(station.stationID, stationInfo.arsID);
  };

  // 버스 노선 선택
  const handleSelectBus = async (bus: BusLaneInfo) => {
    setSelectedBus(bus);
    setSelectedStation(null);
    setStationArrivals([]);
    setBusPositions([]);
    setActiveTab('route');
    setLoadingBusRoute(true);

    // 히스토리 추가
    addToHistory({
      type: 'bus',
      id: bus.busID,
      name: bus.busNo,
      subInfo: bus.busStartPoint && bus.busEndPoint ? `${bus.busStartPoint} → ${bus.busEndPoint}` : undefined,
    });

    try {
      // 공공데이터 API 사용
      const response = await fetch(`/api/bus/route?routeId=${bus.busID}&busNo=${encodeURIComponent(bus.busNo)}`);
      const data = await response.json();
      const stations: BusStationInfo[] = data.stations || [];
      const realtime = data.realtime || [];
      const routeInfo = data.routeInfo;

      // routeInfo가 있으면 selectedBus 업데이트 (첫차/막차/배차간격 등)
      if (routeInfo) {
        // routeType이 유효한 숫자인 경우만 API 값 사용, 아니면 기존 bus.type 유지
        const apiType = typeof routeInfo.routeType === 'number' ? routeInfo.routeType : parseInt(routeInfo.routeType);
        const resolvedType = !isNaN(apiType) && apiType > 0 ? apiType : bus.type;

        setSelectedBus({
          ...bus,
          busNo: routeInfo.routeName || bus.busNo,
          busStartPoint: routeInfo.startStation || bus.busStartPoint,
          busEndPoint: routeInfo.endStation || bus.busEndPoint,
          busFirstTime: routeInfo.firstTime || bus.busFirstTime,
          busLastTime: routeInfo.lastTime || bus.busLastTime,
          busInterval: routeInfo.interval,
          type: resolvedType,
        });
      }

      setBusRouteStations(stations);
      setBusPositions(realtime);
      displayBusRoute(stations, realtime);
    } catch (error) {
      console.error('Bus route fetch error:', error);
    } finally {
      setLoadingBusRoute(false);
    }
  };

  // 도착 정보에서 버스 클릭 시 노선 탭으로 이동
  const handleBusFromArrival = async (arrival: RealtimeArrivalInfo) => {
    // 공공데이터 API로 버스 검색
    try {
      const response = await fetch(`/api/bus/search?q=${encodeURIComponent(arrival.routeNm)}`);
      const data = await response.json();
      const buses: BusLaneInfo[] = data.buses || [];

      // routeNm으로 매칭되는 버스 찾기 (또는 첫 번째 결과 사용)
      const matchedBus = buses.find((b) => b.busNo === arrival.routeNm) || buses[0];

      if (matchedBus) {
        handleSelectBus(matchedBus);
      } else {
        console.log('No matching bus found for:', arrival.routeNm);
      }
    } catch (error) {
      console.error('Bus search error:', error);
    }
  };

  // 버스 마커 초기화
  const clearBusMarkers = () => {
    busMarkersRef.current.forEach((m) => m.setMap(null));
    busMarkersRef.current = [];
  };

  // 버스 노선 경로 표시
  const displayBusRoute = (stations: BusStationInfo[], realtime?: any[]) => {
    if (!mapInstanceRef.current || stations.length === 0) return;

    const kakao = window.kakao;
    const map = mapInstanceRef.current;

    clearMapOverlays();
    clearBusMarkers();

    // 경로 좌표
    const path = stations.map((s) => new kakao.maps.LatLng(parseFloat(s.y), parseFloat(s.x)));

    // 폴리라인
    const polyline = new kakao.maps.Polyline({
      path,
      strokeWeight: 5,
      strokeColor: '#3B82F6',
      strokeOpacity: 0.8,
      strokeStyle: 'solid',
    });
    polyline.setMap(map);
    polylineRef.current = polyline;

    // 시작/종점 마커
    const createStopMarker = (station: BusStationInfo, label: string, color: string) => {
      const position = new kakao.maps.LatLng(parseFloat(station.y), parseFloat(station.x));
      const content = document.createElement('div');
      content.innerHTML = `
        <div style="
          padding: 6px 10px;
          background: ${color};
          border-radius: 16px;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          white-space: nowrap;
        ">
          <span style="color: white; font-size: 12px; font-weight: 600;">${label}</span>
        </div>
      `;
      const overlay = new kakao.maps.CustomOverlay({
        position,
        content,
        yAnchor: 1.5,
      });
      overlay.setMap(map);
      markersRef.current.push(overlay);
    };

    createStopMarker(stations[0], `🚏 ${stations[0].stationName}`, '#10B981');
    createStopMarker(stations[stations.length - 1], `🏁 ${stations[stations.length - 1].stationName}`, '#EF4444');

    // 버스 실시간 위치 마커 표시
    updateBusMarkers(stations, realtime);

    // 지도 범위 조정
    const bounds = new kakao.maps.LatLngBounds();
    stations.forEach((s) => bounds.extend(new kakao.maps.LatLng(parseFloat(s.y), parseFloat(s.x))));
    map.setBounds(bounds);
  };

  // 버스 마커만 업데이트 (지도 축척 유지)
  const updateBusMarkers = (stations: BusStationInfo[], realtime?: any[]) => {
    if (!mapInstanceRef.current || stations.length === 0) return;

    const kakao = window.kakao;
    const map = mapInstanceRef.current;

    // 기존 버스 마커만 제거
    clearBusMarkers();

    if (realtime && realtime.length > 0) {
      realtime.forEach((bus) => {
        // busStationSeq로 해당 정류소 찾기
        const stationIdx = bus.busStationSeq - 1;
        if (stationIdx >= 0 && stationIdx < stations.length) {
          const station = stations[stationIdx];
          const position = new kakao.maps.LatLng(parseFloat(station.y), parseFloat(station.x));

          // 방향 결정: API 응답의 direction 또는 정류소 순번 기준
          // direction: 0=상행(기점→종점), 1=하행(종점→기점)
          const isOutbound = bus.direction === 0 || bus.direction === undefined;
          const directionLabel = isOutbound ? '▶ 종점방향' : '◀ 기점방향';
          const directionColor = isOutbound ? '#3B82F6' : '#F97316'; // 파란색/주황색

          const busContent = document.createElement('div');
          busContent.innerHTML = `
            <div style="
              position: relative;
              display: flex;
              flex-direction: column;
              align-items: center;
            ">
              <div style="
                width: 36px;
                height: 36px;
                background: linear-gradient(135deg, ${directionColor} 0%, ${isOutbound ? '#1D4ED8' : '#EA580C'} 100%);
                border: 3px solid white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 12px ${isOutbound ? 'rgba(59,130,246,0.5)' : 'rgba(249,115,22,0.5)'};
                animation: pulse 2s infinite;
              ">
                <span style="font-size: 16px;">🚌</span>
              </div>
              <div style="
                margin-top: 4px;
                padding: 2px 6px;
                background: ${isOutbound ? 'rgba(59,130,246,0.9)' : 'rgba(249,115,22,0.9)'};
                border-radius: 4px;
                white-space: nowrap;
              ">
                <span style="color: white; font-size: 10px; font-weight: 500;">
                  ${directionLabel}
                </span>
              </div>
              <div style="
                margin-top: 2px;
                padding: 2px 6px;
                background: rgba(0,0,0,0.75);
                border-radius: 4px;
                white-space: nowrap;
              ">
                <span style="color: white; font-size: 10px; font-weight: 500;">
                  ${bus.plateNo || '운행중'}${bus.lowPlate ? ' 🦽' : ''}
                </span>
              </div>
            </div>
          `;

          const busOverlay = new kakao.maps.CustomOverlay({
            position,
            content: busContent,
            yAnchor: 1.4,
            zIndex: 100,
          });
          busOverlay.setMap(map);
          busMarkersRef.current.push(busOverlay);
        }
      });
    }
  };

  // 주변 정류소 클릭 - 바로 정류소 탭으로 이동
  const handleNearbyStationClick = (station: NearbyStation) => {
    handleSelectStation(station);
  };

  // 현재 위치로 이동
  const moveToCurrentLocation = () => {
    if (!mapInstanceRef.current || !currentLocation) return;
    const kakao = window.kakao;
    mapInstanceRef.current.setCenter(new kakao.maps.LatLng(currentLocation.lat, currentLocation.lng));
    mapInstanceRef.current.setLevel(4);
  };

  // 도착 시간 포맷
  const formatArrivalTime = (seconds: number) => {
    if (seconds < 60) return '곧 도착';
    const minutes = Math.floor(seconds / 60);
    return `${minutes}분`;
  };

  // 히스토리에서 선택
  const handleHistorySelect = async (item: SearchHistoryItem) => {
    if (item.type === 'station' && item.x && item.y) {
      // arsID가 없으면 주변 정류소 검색해서 가져오기
      let arsID = item.arsID;
      if (!arsID && item.x && item.y) {
        try {
          // 공공데이터포털 API로 정류소 좌표 근처에서 검색
          const response = await fetch(`/api/bus/station/nearby?x=${item.x}&y=${item.y}&radius=100`);
          const data = await response.json();
          const station = data.stations?.find((s: NearbyStation) => s.stationID === item.id);
          if (station?.arsID) {
            arsID = station.arsID;
          }
        } catch (error) {
          console.error('Station search for arsID error:', error);
        }
      }

      handleSelectStation({
        stationID: item.id,
        stationName: item.name,
        x: item.x,
        y: item.y,
        CID: 1,
        arsID,
      });
    } else if (item.type === 'bus') {
      // 공공데이터 API로 버스 검색
      try {
        const response = await fetch(`/api/bus/search?q=${encodeURIComponent(item.name)}`);
        const data = await response.json();
        const bus = data.buses?.find((b: BusLaneInfo) => b.busID === item.id) || data.buses?.[0];
        if (bus) handleSelectBus(bus);
      } catch (error) {
        console.error('Bus search error:', error);
      }
    }
  };

  // 선택 초기화
  const clearSelection = () => {
    setSelectedStation(null);
    setStationArrivals([]);
    setSelectedBus(null);
    setBusRouteStations([]);
    clearMapOverlays();
  };

  const tabs = [
    { id: 'station' as TabType, label: '정류소', icon: '🚏' },
    { id: 'route' as TabType, label: '노선', icon: '🚌' },
    { id: 'search' as TabType, label: '길찾기', icon: '🗺️' },
    { id: 'tracking' as TabType, label: '추적', icon: '📊' },
  ];

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-3rem)] overflow-hidden">
      {/* 사이드 패널 - 모바일에서는 하단에서 올라오는 시트 형태 */}
      <div
        className={cn(
          "bg-background flex flex-col transition-all duration-300",
          // 모바일: 하단 시트 스타일
          "fixed md:relative inset-x-0 bottom-0 md:inset-auto z-20 md:z-auto",
          "rounded-t-2xl md:rounded-none border-t md:border-t-0 md:border-r border-border",
          "shadow-[0_-4px_20px_rgba(0,0,0,0.1)] md:shadow-none",
          // 패널 너비/높이
          isPanelOpen
            ? "h-[70vh] md:h-auto md:w-96 md:flex-shrink-0"
            : "h-0 md:h-auto md:w-0"
        )}
      >
        {/* 모바일 드래그 핸들 */}
        <div className="md:hidden flex justify-center py-2">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* 탭 헤더 */}
        <div className="flex-shrink-0 px-3 pb-3 md:p-3 border-b border-border bg-muted/30">
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
              </button>
            ))}
          </div>
        </div>

        {/* 탭 내용 */}
        <div className="flex-1 overflow-y-auto">
          {/* 정류소 탭 */}
          {activeTab === 'station' && (
            <div className="p-4">
              <StationSearchInput
                onSelect={handleSelectStation}
                placeholder="정류소명을 입력하세요"
                className="mb-4"
              />

              {/* 즐겨찾기 정류소 (선택된 정류소가 없을 때 표시) */}
              {!selectedStation && favoriteStations.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-muted-foreground">즐겨찾기</span>
                    <span className="text-xs text-muted-foreground">({favoriteStations.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {favoriteStations.map((station) => (
                      <div
                        key={station.id}
                        className="group flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full text-sm hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                      >
                        <button
                          onClick={() => {
                            setSelectedStation({
                              stationID: station.station_id,
                              stationName: station.station_name,
                              x: station.x || '',
                              y: station.y || '',
                              CID: 1, // 수도권 기본값
                            });
                            fetchStationArrivals(station.station_id);
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <span className="text-amber-600 dark:text-amber-400">⭐</span>
                          <span className="text-foreground">{station.station_name}</span>
                        </button>
                        <button
                          onClick={() => removeFavoriteStation(station.station_id)}
                          className="ml-1 p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedStation ? (
                <div className="space-y-3">
                  {/* 선택된 정류소 정보 */}
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-lg">🚏</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground">{selectedStation.stationName}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          ID: {selectedStation.stationID}
                          {selectedStation.arsID && ` · ${selectedStation.arsID}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            if (isStationFavorite(selectedStation.stationID)) {
                              removeFavoriteStation(selectedStation.stationID);
                            } else {
                              addFavoriteStation(selectedStation);
                            }
                          }}
                          className="p-1.5 hover:bg-accent rounded transition-colors"
                          title={isStationFavorite(selectedStation.stationID) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                        >
                          {isStationFavorite(selectedStation.stationID) ? (
                            <svg className="w-5 h-5 text-amber-500" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={clearSelection}
                          className="p-1 hover:bg-accent rounded"
                        >
                          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* 도착 정보 */}
                  <div className="border border-border rounded-lg overflow-hidden">
                    <div className="p-3 bg-muted/50 border-b border-border flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">실시간 도착 정보</span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <CircularCountdown duration={15} size={16} strokeWidth={2} />
                          <span>{stationCountdown}초</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          fetchStationArrivals(selectedStation.stationID, selectedStation.arsID);
                          setStationCountdown(15);
                        }}
                      >
                        새로고침
                      </Button>
                    </div>

                    {loadingArrivals ? (
                      <div className="p-8 flex justify-center">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : stationArrivals.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">
                        도착 예정 버스가 없습니다
                      </div>
                    ) : (
                      <div className="max-h-[calc(100vh-380px)] overflow-y-auto divide-y divide-border">
                        {stationArrivals.map((arrival, idx) => {
                          const busStyle = getBusTypeStyle(arrival.routeType);
                          const crowded1 = getCrowdedInfo(arrival.arrival1?.crowded);
                          const crowded2 = getCrowdedInfo(arrival.arrival2?.crowded);
                          const isTracking = stationTrackingBusIds.includes(arrival.routeID);

                          return (
                            <div
                              key={`${arrival.routeID}-${idx}`}
                              className="p-3 hover:bg-accent/50 transition-colors"
                            >
                              <div className="flex items-start gap-3">
                                {/* 버스 번호 및 타입 */}
                                <button
                                  onClick={() => handleBusFromArrival(arrival)}
                                  className="flex flex-col items-center gap-1"
                                >
                                  <span className={cn(
                                    "px-2.5 py-1 text-sm font-bold rounded-lg",
                                    busStyle.bg, busStyle.text
                                  )}>
                                    {arrival.routeNm}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground">
                                    {busStyle.label}
                                  </span>
                                </button>

                                {/* 도착 정보 */}
                                <button
                                  onClick={() => handleBusFromArrival(arrival)}
                                  className="flex-1 min-w-0 text-left"
                                >
                                  {/* 첫 번째 버스 */}
                                  {arrival.arrival1 && (
                                    <div className="mb-2">
                                      <div className="flex items-center gap-2">
                                        <span className="text-base font-semibold text-foreground">
                                          {formatArrivalTime(arrival.arrival1.arrivalSec)}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          {arrival.arrival1.leftStation}정거장 전
                                        </span>
                                        {isTracking && (
                                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-primary/10 text-primary border-primary/20">
                                            추적중
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        {arrival.arrival1.lowPlate && (
                                          <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-600 border-blue-200">
                                            🦽 저상
                                          </Badge>
                                        )}
                                        {crowded1 && (
                                          <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", crowded1.color)}>
                                            {crowded1.icon} {crowded1.label}
                                          </Badge>
                                        )}
                                        {arrival.arrival1.remainSeat !== undefined && arrival.arrival1.remainSeat >= 0 && (
                                          <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                            💺 {arrival.arrival1.remainSeat}석
                                          </Badge>
                                        )}
                                        {arrival.arrival1.busPlateNo && (
                                          <span className="text-[10px] text-muted-foreground">
                                            {arrival.arrival1.busPlateNo}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* 두 번째 버스 */}
                                  {arrival.arrival2 && (
                                    <div className="pt-2 border-t border-border/50">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-muted-foreground">
                                          다음: {formatArrivalTime(arrival.arrival2.arrivalSec)}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                          ({arrival.arrival2.leftStation}정거장)
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                                        {arrival.arrival2.lowPlate && (
                                          <Badge variant="outline" className="text-[10px] h-4 px-1 bg-blue-50 text-blue-600 border-blue-200">
                                            저상
                                          </Badge>
                                        )}
                                        {crowded2 && (
                                          <span className={cn("text-[10px]", crowded2.color)}>
                                            {crowded2.icon} {crowded2.label}
                                          </span>
                                        )}
                                        {arrival.arrival2.remainSeat !== undefined && arrival.arrival2.remainSeat >= 0 && (
                                          <span className="text-[10px] text-muted-foreground">
                                            💺 {arrival.arrival2.remainSeat}석
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </button>

                                {/* 추적 버튼 */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleStationTracking(arrival.routeID, arrival.routeNm);
                                  }}
                                  className={cn(
                                    "p-2 rounded-full transition-colors flex-shrink-0",
                                    isTracking
                                      ? "bg-primary/10 text-primary"
                                      : "bg-muted text-muted-foreground hover:text-primary hover:bg-primary/10"
                                  )}
                                  title={isTracking ? '추적 해제' : '도착 시간 추적'}
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* 최근 검색 히스토리 */}
                  {searchHistory.filter((h) => h.type === 'station').length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs text-muted-foreground mb-2">최근 검색</p>
                      <div className="space-y-1">
                        {searchHistory
                          .filter((h) => h.type === 'station')
                          .slice(0, 5)
                          .map((item) => (
                            <button
                              key={`${item.type}-${item.id}`}
                              onClick={() => handleHistorySelect(item)}
                              className="w-full p-2 text-left rounded-lg hover:bg-accent/50 transition-colors flex items-center gap-2"
                            >
                              <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className="text-sm">{item.name}</span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* 주변 정류소 섹션 */}
                  <div className="mt-4 border-t border-border pt-4">
                    {/* 반경 선택 */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">반경</span>
                      <div className="flex gap-1 flex-1">
                        {[300, 500, 1000].map((radius) => (
                          <button
                            key={radius}
                            onClick={() => setSearchRadius(radius)}
                            className={cn(
                              "flex-1 py-1.5 text-xs rounded-md transition-colors",
                              searchRadius === radius
                                ? "bg-primary text-primary-foreground"
                                : "bg-background border border-border hover:bg-accent"
                            )}
                          >
                            {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 주변 정류소 헤더 */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">주변 정류소</span>
                        {loadingNearby ? (
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <span className="text-xs text-muted-foreground">({nearbyStations.length})</span>
                        )}
                      </div>
                      {mapCenter && (
                        <button
                          onClick={() => fetchNearbyStations()}
                          className="text-xs text-primary hover:underline"
                        >
                          새로고침
                        </button>
                      )}
                    </div>

                    {/* 주변 정류소 리스트 */}
                    {loadingNearby ? (
                      <div className="flex justify-center py-8">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : nearbyStations.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground">주변에 정류소가 없습니다</p>
                        <p className="text-xs text-muted-foreground mt-1">지도를 이동해보세요</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {nearbyStations.map((station, idx) => (
                          <button
                            key={station.stationID}
                            onClick={() => handleNearbyStationClick(station)}
                            className="w-full p-3 text-left rounded-lg border border-border hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-green-500">
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground text-sm truncate">{station.stationName}</p>
                              </div>
                              <Badge variant="secondary" className="flex-shrink-0 text-xs">
                                {Math.round(station.distance)}m
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 노선 탭 */}
          {activeTab === 'route' && (
            <div className="p-4">
              <BusSearchInput
                onSelect={handleSelectBus}
                placeholder="버스 번호를 입력하세요"
                className="mb-4"
              />

              {/* 즐겨찾기 노선 (선택된 버스가 없고 로딩 중이 아닐 때 표시) */}
              {!selectedBus && !loadingBusRoute && favoriteRoutes.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-muted-foreground">즐겨찾기</span>
                    <span className="text-xs text-muted-foreground">({favoriteRoutes.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {favoriteRoutes.map((route) => (
                      <div
                        key={route.id}
                        className="group flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-full text-sm hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                      >
                        <button
                          onClick={() => {
                            // handleSelectBus를 호출하여 노선 상세 정보 로드
                            handleSelectBus({
                              busID: route.bus_id,
                              busNo: route.bus_no,
                              type: route.bus_type || 0,
                              busCityCode: 1,
                            });
                          }}
                          className="flex items-center gap-1.5"
                        >
                          <span className="text-amber-600 dark:text-amber-400">⭐</span>
                          <span className="font-bold text-primary">{route.bus_no}</span>
                        </button>
                        <button
                          onClick={() => removeFavoriteRoute(route.bus_id)}
                          className="ml-1 p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {loadingBusRoute ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                  <p className="text-sm text-muted-foreground">노선 정보 로딩 중...</p>
                </div>
              ) : selectedBus ? (
                <div className="space-y-4">
                  {/* 선택된 버스 정보 카드 */}
                  {(() => {
                    const busStyle = getBusTypeStyle(selectedBus.type);
                    // 타입별 그라데이션 색상 (경기도 도착정보 API routeTypeCd 기준)
                    const gradientColors: Record<number, string> = {
                      // 서울시
                      1: 'from-green-500 to-green-600', // 지선
                      3: 'from-emerald-500 to-emerald-600', // 마을
                      4: 'from-red-500 to-red-600', // 광역
                      5: 'from-sky-500 to-sky-600', // 공항
                      6: 'from-blue-500 to-blue-600', // 간선
                      // 경기도 시내버스
                      11: 'from-red-500 to-red-600', // 직행좌석
                      12: 'from-green-600 to-green-700', // 좌석
                      13: 'from-green-500 to-green-600', // 일반
                      14: 'from-red-600 to-red-700', // 광역급행
                      15: 'from-purple-500 to-purple-600', // 따복
                      16: 'from-blue-600 to-blue-700', // 경기순환
                      // 경기도 농어촌버스
                      21: 'from-red-500 to-red-600', // 직행좌석
                      22: 'from-green-600 to-green-700', // 좌석
                      23: 'from-green-500 to-green-600', // 일반
                      // 마을버스
                      30: 'from-emerald-500 to-emerald-600', // 마을
                      // 시외버스
                      41: 'from-purple-600 to-purple-700', // 고속
                      42: 'from-purple-500 to-purple-600', // 좌석시외
                      43: 'from-purple-500 to-purple-600', // 일반시외
                      // 공항버스
                      51: 'from-sky-600 to-sky-700', // 리무진
                      52: 'from-sky-500 to-sky-600', // 좌석공항
                      53: 'from-sky-500 to-sky-600', // 일반공항
                    };
                    const gradient = gradientColors[selectedBus.type] || 'from-blue-500 to-blue-600';

                    return (
                      <div className={cn("relative overflow-hidden rounded-xl bg-gradient-to-br text-white p-4 shadow-lg", gradient)}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

                        <div className="relative">
                          {/* 헤더: 버스번호 + 타입 + 즐겨찾기/닫기 버튼 */}
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <span className="text-3xl font-bold whitespace-nowrap">{selectedBus.busNo}</span>
                              <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 text-xs">
                                {busStyle.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  if (isRouteFavorite(selectedBus.busID)) {
                                    removeFavoriteRoute(selectedBus.busID);
                                  } else {
                                    addFavoriteRoute(selectedBus);
                                  }
                                }}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                                title={isRouteFavorite(selectedBus.busID) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                              >
                                {isRouteFavorite(selectedBus.busID) ? (
                                  <svg className="w-5 h-5 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                  </svg>
                                )}
                              </button>
                              <button
                                onClick={clearSelection}
                                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>

                          {/* 기점 → 종점 */}
                          {selectedBus.busStartPoint && selectedBus.busEndPoint && (
                            <div className="bg-white/10 backdrop-blur rounded-lg p-3 mb-3">
                              <div className="flex items-center gap-2">
                                <div className="flex flex-col items-center">
                                  <div className="w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                                  <div className="w-0.5 h-4 bg-white/40" />
                                  <div className="w-3 h-3 bg-red-400 rounded-full border-2 border-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{selectedBus.busStartPoint}</p>
                                  <p className="text-xs text-white/60 my-1">↓</p>
                                  <p className="text-sm font-medium truncate">{selectedBus.busEndPoint}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* 운행 정보 그리드 */}
                          <div className="grid grid-cols-3 gap-2">
                            {/* 첫차 */}
                            <div className="bg-white/10 backdrop-blur rounded-lg p-2">
                              <p className="text-[10px] text-white/60 mb-0.5">첫차</p>
                              <p className="text-sm font-semibold">{selectedBus.busFirstTime || '--:--'}</p>
                            </div>
                            {/* 막차 */}
                            <div className="bg-white/10 backdrop-blur rounded-lg p-2">
                              <p className="text-[10px] text-white/60 mb-0.5">막차</p>
                              <p className="text-sm font-semibold">{selectedBus.busLastTime || '--:--'}</p>
                            </div>
                            {/* 배차간격 */}
                            <div className="bg-white/10 backdrop-blur rounded-lg p-2">
                              <p className="text-[10px] text-white/60 mb-0.5">배차</p>
                              <p className="text-sm font-semibold">
                                {selectedBus.busInterval ? `${selectedBus.busInterval}분` : '--'}
                              </p>
                            </div>
                            {/* 정류소 수 */}
                            <div className="bg-white/10 backdrop-blur rounded-lg p-2">
                              <p className="text-[10px] text-white/60 mb-0.5">정류소</p>
                              <p className="text-sm font-semibold">{busRouteStations.length}개</p>
                            </div>
                            {/* 운행 버스 */}
                            <div className="bg-white/10 backdrop-blur rounded-lg p-2">
                              <p className="text-[10px] text-white/60 mb-0.5">운행중</p>
                              <p className="text-sm font-semibold">{busPositions.length}대</p>
                            </div>
                            {/* 빈 공간 또는 추가 정보 */}
                            <div className="bg-white/10 backdrop-blur rounded-lg p-2">
                              <p className="text-[10px] text-white/60 mb-0.5">노선ID</p>
                              <p className="text-[11px] font-medium truncate">{selectedBus.busID}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* 실시간 버스 위치 */}
                  {busPositions.length > 0 && (
                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                      <div className="p-3 bg-muted/50 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CircularCountdown duration={10} size={16} strokeWidth={2} />
                          <span className="text-sm font-medium">운행중인 버스</span>
                          <span className="text-[10px] text-muted-foreground">
                            자동갱신
                          </span>
                        </div>
                      </div>
                      <div className="divide-y divide-border">
                        {busPositions.map((bus, idx) => {
                          const stationIdx = bus.busStationSeq - 1;
                          const currentStation = busRouteStations[stationIdx];
                          const crowdedInfo = getCrowdedInfo(bus.crowded);
                          const progress = busRouteStations.length > 0
                            ? Math.round((bus.busStationSeq / busRouteStations.length) * 100)
                            : 0;

                          return (
                            <div key={idx} className="p-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                                  <span className="text-lg">🚌</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium">{bus.plateNo || '차량번호 없음'}</span>
                                    {bus.lowPlate && (
                                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-50 text-blue-600 border-blue-200">
                                        🦽 저상
                                      </Badge>
                                    )}
                                    {crowdedInfo && (
                                      <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5", crowdedInfo.color)}>
                                        {crowdedInfo.icon} {crowdedInfo.label}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {currentStation ? `${bus.busStationSeq}번째 - ${currentStation.stationName}` : `${bus.busStationSeq}번째 정류소`}
                                  </p>
                                </div>
                              </div>
                              {/* 진행률 바 */}
                              <div className="mt-2 ml-13">
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 rounded-full transition-all"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                  {bus.busStationSeq} / {busRouteStations.length} 정류소 ({progress}%)
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 경유 정류소 타임라인 */}
                  {busRouteStations.length > 0 && (
                    <div className="bg-card rounded-xl border border-border overflow-hidden">
                      <div className="p-3 bg-muted/50 border-b border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          <span className="text-sm font-medium">경유 정류소</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {busRouteStations.length}개
                        </Badge>
                      </div>
                      <div className="max-h-[calc(100vh-480px)] overflow-y-auto">
                        {busRouteStations.map((station, idx) => {
                          const isFirst = idx === 0;
                          const isLast = idx === busRouteStations.length - 1;
                          // 이 정류소에 있는 버스들 찾기
                          const busesAtStation = busPositions.filter((b) => b.busStationSeq === idx + 1);
                          const hasBus = busesAtStation.length > 0;

                          return (
                            <button
                              key={`${station.stationID}-${idx}`}
                              onClick={() => handleSelectStation(station as any)}
                              className={cn(
                                "w-full text-left hover:bg-accent/50 transition-colors group",
                                hasBus && "bg-blue-50 dark:bg-blue-900/20"
                              )}
                            >
                              <div className="flex items-stretch">
                                {/* 타임라인 */}
                                <div className="w-12 flex flex-col items-center py-3">
                                  <div className={cn(
                                    "w-0.5 flex-1",
                                    isFirst ? "bg-transparent" : "bg-border"
                                  )} />
                                  {hasBus ? (
                                    <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg animate-pulse">
                                      <span className="text-sm">🚌</span>
                                    </div>
                                  ) : (
                                    <div className={cn(
                                      "w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center",
                                      isFirst ? "bg-green-500 border-green-500" :
                                      isLast ? "bg-red-500 border-red-500" :
                                      "bg-background border-border group-hover:border-primary"
                                    )}>
                                      {(isFirst || isLast) && (
                                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                      )}
                                    </div>
                                  )}
                                  <div className={cn(
                                    "w-0.5 flex-1",
                                    isLast ? "bg-transparent" : "bg-border"
                                  )} />
                                </div>

                                {/* 정류소 정보 */}
                                <div className="flex-1 py-3 pr-4 border-b border-border/50 last:border-b-0">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className={cn(
                                        "text-sm font-medium",
                                        hasBus ? "text-blue-600 dark:text-blue-400" :
                                        (isFirst || isLast) ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                                      )}>
                                        {station.stationName}
                                      </p>
                                      {hasBus && (
                                        <p className="text-xs text-blue-500 mt-0.5">
                                          {busesAtStation.map((b) => b.plateNo || '버스').join(', ')} 도착
                                        </p>
                                      )}
                                      {!hasBus && station.arsID && (
                                        <p className="text-xs text-muted-foreground/70 mt-0.5">
                                          {station.arsID}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-muted-foreground">{idx + 1}</span>
                                      <svg className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* 최근 검색 히스토리 */}
                  {searchHistory.filter((h) => h.type === 'bus').length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm font-medium text-muted-foreground">최근 검색</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {searchHistory
                          .filter((h) => h.type === 'bus')
                          .slice(0, 6)
                          .map((item) => (
                            <button
                              key={`${item.type}-${item.id}`}
                              onClick={() => handleHistorySelect(item)}
                              className="p-3 text-left rounded-xl border border-border hover:border-primary/50 hover:bg-accent/30 transition-all group"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 bg-blue-500 text-white text-sm font-bold rounded-md">
                                  {item.name}
                                </span>
                              </div>
                              {item.subInfo && (
                                <p className="text-xs text-muted-foreground truncate">
                                  {item.subInfo}
                                </p>
                              )}
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20 rounded-2xl flex items-center justify-center mb-4">
                      <svg className="w-10 h-10 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </div>
                    <p className="text-muted-foreground text-sm">
                      버스 번호를 검색하거나<br />정류소에서 버스를 선택하세요
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* 길찾기 탭 */}
          {activeTab === 'search' && (
            <div className="p-4">
              <SearchForm onSearch={handleRouteSearch} />

              {/* 검색 결과 */}
              {routeSearchOrigin && routeSearchDest && (
                <div className="mt-4">
                  {/* 출발/도착 표시 */}
                  <div className="p-3 bg-muted/50 rounded-lg mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span className="text-sm truncate">{matchedPlaces.origin || routeSearchOrigin}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <span className="text-sm truncate">{matchedPlaces.dest || routeSearchDest}</span>
                    </div>
                  </div>

                  {/* 로딩 */}
                  {loadingRoutes && (
                    <div className="flex items-center justify-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm text-muted-foreground">경로 검색 중...</span>
                      </div>
                    </div>
                  )}

                  {/* 에러 */}
                  {routeError && !loadingRoutes && (
                    <div className="text-center py-8">
                      <p className="text-destructive text-sm mb-1">{routeError}</p>
                      <p className="text-xs text-muted-foreground">더 정확한 장소명을 입력해보세요</p>
                    </div>
                  )}

                  {/* 경로 목록 */}
                  {!loadingRoutes && !routeError && routes.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground mb-2">{routes.length}개의 경로</p>
                      {routes.map((route, index) => (
                        <button
                          key={route.id}
                          onClick={() => handleRouteSelect(route)}
                          className={cn(
                            "w-full p-3 text-left rounded-lg border border-border hover:bg-accent/50 transition-colors",
                            selectedRoute?.id === route.id && "bg-accent border-primary"
                          )}
                        >
                          {index === 0 && (
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-amber-500 text-white text-xs">추천</Badge>
                              <PathTypeBadge pathType={route.pathType} />
                            </div>
                          )}

                          <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-xl font-bold">{route.totalTime}</span>
                            <span className="text-sm text-muted-foreground">분</span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              환승 {route.transferCount}회
                            </span>
                          </div>

                          <div className="flex items-center gap-1 mb-2 flex-wrap">
                            {route.legs.map((leg, legIndex) => (
                              <div key={legIndex} className="flex items-center gap-1">
                                {leg.mode === 'walk' ? (
                                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                    <RouteWalkIcon className="h-3 w-3" />
                                    {leg.duration}분
                                  </span>
                                ) : (
                                  <span
                                    className={cn(
                                      "px-1.5 py-0.5 rounded text-xs font-medium text-white",
                                      leg.mode === 'bus' && "bg-blue-500",
                                      leg.mode === 'subway' && "bg-green-500"
                                    )}
                                  >
                                    {leg.routeName}
                                  </span>
                                )}
                                {legIndex < route.legs.length - 1 && (
                                  <svg className="h-3 w-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{(route.fare || 0).toLocaleString()}원</span>
                            {route.totalDistance && (
                              <span>{(route.totalDistance / 1000).toFixed(1)}km</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {!loadingRoutes && !routeError && routes.length === 0 && routeSearchOrigin && routeSearchDest && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground text-sm">검색 결과가 없습니다</p>
                    </div>
                  )}
                </div>
              )}

              {/* 검색 전 - 최근 검색 표시 */}
              {!routeSearchOrigin && !routeSearchDest && (
                <>
                  {recentSearches.length > 0 ? (
                    <div className="mt-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-muted-foreground">최근 검색</span>
                        <span className="text-xs text-muted-foreground">{recentSearches.length}개</span>
                      </div>
                      <div className="space-y-2">
                        {recentSearches.slice(0, 5).map((search, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleRecentRouteSearch(search)}
                            className="w-full p-3 text-left border border-border rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center text-sm">
                                  <span className="truncate font-medium">{search.origin}</span>
                                  <svg className="mx-2 h-3 w-3 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                  </svg>
                                  <span className="truncate">{search.destination}</span>
                                </div>
                              </div>
                              <svg className="w-4 h-4 text-muted-foreground flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                      </div>
                      <p className="text-muted-foreground text-sm">
                        출발지와 도착지를 입력하여<br />경로를 검색하세요
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* 선택된 경로 상세 */}
              {selectedRoute && (
                <div className="mt-4 p-4 border-t border-border bg-muted/30 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">{selectedRoute.totalTime}분</span>
                      <PathTypeBadge pathType={selectedRoute.pathType} />
                    </div>
                    <button
                      onClick={() => setSelectedRoute(null)}
                      className="p-1 hover:bg-accent rounded"
                    >
                      <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <RouteTimeline legs={selectedRoute.legs} />
                </div>
              )}
            </div>
          )}

          {/* 추적 탭 */}
          {activeTab === 'tracking' && (
            <div>
              {loadingTracking ? (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : trackingTargets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <p className="text-muted-foreground text-sm mb-2">추적 중인 버스가 없습니다</p>
                  <p className="text-xs text-muted-foreground/70 mb-4">
                    정류소 탭에서 버스 옆의 📊 버튼을 눌러 추적을 시작하세요
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('station')}
                  >
                    정류소 검색으로 이동
                  </Button>
                </div>
              ) : (
                <>
                  {/* 헤더: 카운트다운 및 새로고침 */}
                  <div className="p-3 bg-muted/50 border-b border-border sticky top-0 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">
                        추적 대상 {trackingTargets.length}개
                      </span>
                      {trackingTargets.some(t => t.is_active) && (
                        <span className="text-xs text-muted-foreground">
                          ({trackingCountdown}초 후 갱신)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {checkingTrackingArrivals && (
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          checkTrackingArrivals();
                          setTrackingCountdown(30);
                        }}
                        disabled={checkingTrackingArrivals}
                      >
                        새로고침
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push('/tracking')}
                      >
                        상세 관리
                      </Button>
                    </div>
                  </div>

                  {/* 추적 대상 목록 */}
                  <div className="divide-y divide-border">
                    {trackingTargets.map((target) => {
                      const busStyle = getBusTypeStyle(undefined); // 기본 스타일

                      return (
                        <div key={target.id} className="p-4">
                          <div className="flex items-start gap-3">
                            {/* 버스 번호 */}
                            <button
                              onClick={() => handleSelectStation({
                                stationID: target.station_id,
                                stationName: target.station_name,
                                x: '',
                                y: '',
                                CID: 1,
                              })}
                              className="px-3 py-1 bg-primary text-primary-foreground text-sm font-bold rounded hover:opacity-90 transition-opacity"
                            >
                              {target.bus_no}
                            </button>

                            {/* 정류소 및 도착 정보 */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate">
                                {target.station_name}
                              </p>
                              {target.is_active && target.arrival ? (
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={cn(
                                    "text-lg font-bold",
                                    target.arrival.arrivalSec <= 120
                                      ? "text-red-500"
                                      : target.arrival.arrivalSec <= 300
                                      ? "text-amber-500"
                                      : "text-primary"
                                  )}>
                                    {target.arrival.arrivalSec < 60
                                      ? '곧 도착'
                                      : `${Math.floor(target.arrival.arrivalSec / 60)}분`}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    ({target.arrival.leftStation}정류장 전)
                                  </span>
                                </div>
                              ) : target.is_active && target.lastChecked ? (
                                <p className="text-xs text-muted-foreground mt-1">
                                  도착 정보 없음
                                </p>
                              ) : !target.is_active ? (
                                <Badge variant="secondary" className="mt-1 text-xs">
                                  비활성
                                </Badge>
                              ) : null}
                            </div>

                            {/* 액션 버튼들 */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {/* 수동 도착 기록 - 더 눈에 띄는 버튼 */}
                              <button
                                onClick={() => handleManualLogArrival(target)}
                                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 dark:text-green-300 dark:bg-green-900/30 dark:hover:bg-green-900/50 rounded-md transition-colors"
                                title="도착 기록"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                기록
                              </button>

                              {/* 통계 보기 */}
                              <button
                                onClick={() => handleViewStats(target)}
                                className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
                                title="통계 보기"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                              </button>

                              {/* 활성/비활성 토글 */}
                              <button
                                onClick={() => handleTrackingToggle(target)}
                                className={cn(
                                  "p-2 rounded-full transition-colors",
                                  target.is_active
                                    ? "text-primary hover:bg-primary/10"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                )}
                                title={target.is_active ? '비활성화' : '활성화'}
                              >
                                {target.is_active ? (
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                                  </svg>
                                )}
                              </button>

                              {/* 삭제 */}
                              <button
                                onClick={() => handleTrackingDelete(target.id)}
                                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors"
                                title="삭제"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

      </div>

      {/* 지도 영역 */}
      <div className="flex-1 relative">
        <div ref={mapRef} className="w-full h-full" />

        {/* 패널 토글 버튼 - 데스크탑에서만 좌측에 표시 */}
        <button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className="hidden md:block absolute top-4 left-4 z-10 bg-white p-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
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

        {/* 모바일 패널 토글 버튼 - 하단 중앙에 표시 */}
        <button
          onClick={() => setIsPanelOpen(!isPanelOpen)}
          className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-white px-4 py-2 rounded-full shadow-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <svg
            className={cn("w-4 h-4 text-gray-600 transition-transform", isPanelOpen && "rotate-180")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
          <span className="text-sm font-medium text-gray-600">{isPanelOpen ? '지도 보기' : '메뉴 열기'}</span>
        </button>

        {/* 현재 위치 버튼 */}
        <button
          onClick={moveToCurrentLocation}
          className="absolute bottom-16 md:bottom-4 right-4 z-10 w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>

        {/* 줌 컨트롤 */}
        <div className="absolute bottom-28 md:bottom-16 right-4 z-10 flex flex-col bg-white rounded-lg shadow-lg overflow-hidden">
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
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">지도 로딩 중...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 길찾기 탭 헬퍼 컴포넌트들
function RouteTimeline({ legs }: { legs: RouteLeg[] }) {
  return (
    <div className="relative">
      {legs.map((leg, index) => (
        <div key={index} className="flex gap-3 pb-3 last:pb-0">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-white",
                leg.mode === 'walk' && "bg-gray-400",
                leg.mode === 'bus' && "bg-blue-500",
                leg.mode === 'subway' && "bg-green-500"
              )}
            >
              {leg.mode === 'walk' && <RouteWalkIcon className="h-3.5 w-3.5" />}
              {leg.mode === 'bus' && <RouteBusIcon className="h-3.5 w-3.5" />}
              {leg.mode === 'subway' && <RouteSubwayIcon className="h-3.5 w-3.5" />}
            </div>
            {index < legs.length - 1 && (
              <div className="w-0.5 flex-1 bg-gray-200 my-1" />
            )}
          </div>

          <div className="flex-1 pb-2">
            {leg.mode === 'walk' ? (
              <div>
                <p className="text-sm text-muted-foreground">
                  도보 {leg.duration}분
                  {leg.distance && <span className="ml-1">({leg.distance}m)</span>}
                </p>
                <p className="text-xs text-muted-foreground/70">{leg.startName} → {leg.endName}</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={cn(
                      "px-1.5 py-0.5 rounded text-xs font-bold text-white",
                      leg.mode === 'bus' && "bg-blue-500",
                      leg.mode === 'subway' && "bg-green-500"
                    )}
                  >
                    {leg.routeName}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {leg.duration}분
                    {leg.stationCount && <span className="ml-1">({leg.stationCount}정거장)</span>}
                  </span>
                </div>
                <p className="text-sm font-medium">{leg.startName}</p>
                <p className="text-xs text-muted-foreground/70">→ {leg.endName}</p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function PathTypeBadge({ pathType }: { pathType?: number }) {
  switch (pathType) {
    case 1:
      return <Badge className="bg-green-500 text-white text-xs">지하철</Badge>;
    case 2:
      return <Badge className="bg-blue-500 text-white text-xs">버스</Badge>;
    case 3:
      return <Badge className="bg-purple-500 text-white text-xs">버스+지하철</Badge>;
    default:
      return null;
  }
}

function RouteWalkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" />
    </svg>
  );
}

function RouteBusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z" />
    </svg>
  );
}

function RouteSubwayIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2c-4.42 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm2 0V6h5v5h-5zm3.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
    </svg>
  );
}

function BusPageLoading() {
  return (
    <div className="h-[calc(100dvh-3rem)] flex items-center justify-center bg-muted/30">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-muted-foreground">로딩 중...</span>
      </div>
    </div>
  );
}

export default function BusPage() {
  return (
    <Suspense fallback={<BusPageLoading />}>
      <BusPageContent />
    </Suspense>
  );
}
