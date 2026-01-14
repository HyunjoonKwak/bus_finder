'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StationSearchInput } from '@/components/station/StationSearchInput';
import { BusSearchInput } from '@/components/bus/BusSearchInput';
import { loadKakaoMapScript, getCurrentPosition } from '@/lib/kakao';
import { cn } from '@/lib/utils';
import type { StationInfo, NearbyStationInfo, BusLaneInfo, BusStationInfo, RealtimeArrivalInfo } from '@/lib/odsay/types';
import { createClient } from '@/lib/supabase/client';
import { BusSidebar } from '@/components/bus/BusSidebar';
import { BusRouteDetail } from '@/components/bus/BusRouteDetail';
import { StationArrivals } from '@/components/station/StationArrivals';
import { NearbyStations, NearbyStation } from '@/components/station/NearbyStations';
import { MobileBottomSheet } from '@/components/mobile/MobileBottomSheet';
import { MobileSearchOverlay } from '@/components/mobile/MobileSearchOverlay';
import { MobileInfoCard } from '@/components/mobile/MobileInfoCard';
import { MobileDetailPanel } from '@/components/mobile/MobileDetailPanel';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Kakao Maps 타입 정의 (SDK가 TypeScript를 완전 지원하지 않아 any 사용)
type KakaoMap = any;
type KakaoLatLng = any;
type KakaoLatLngBounds = any;
type KakaoOverlay = any;
type KakaoCircle = any;
type KakaoPolyline = any;
type KakaoCustomOverlay = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

interface BusPosition {
  stationSeq: number;
  busStationSeq: number;
  plateNo: string;
  lowPlate?: boolean;
  crowded?: number;
  direction?: number;
}

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

interface TrackingTarget {
  id: string;
  bus_id: string;
  bus_no: string;
  station_id: string;
  station_name: string;
  ars_id?: string;
  is_active: boolean;
}

interface TrackingTargetWithArrival extends TrackingTarget {
  arrival?: {
    arrivalSec: number;
    leftStation: number;
  };
  lastChecked?: Date;
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

function BusPageContent() {
  const searchParams = useSearchParams();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<KakaoMap | null>(null);
  const markersRef = useRef<KakaoCustomOverlay[]>([]);
  const busMarkersRef = useRef<KakaoCustomOverlay[]>([]);
  const stationMarkersRef = useRef<KakaoCustomOverlay[]>([]);
  const polylineRef = useRef<KakaoPolyline | null>(null);
  const radiusCircleRef = useRef<KakaoCircle | null>(null);
  const centerMarkerRef = useRef<KakaoCustomOverlay | null>(null);
  const dragendListenerRef = useRef<(() => void) | null>(null);

  const tabParam = searchParams.get('tab') as TabType | null;
  const initialTab = tabParam && ['station', 'route', 'search', 'tracking'].includes(tabParam) ? tabParam : 'station';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const [_mapLoaded, setMapLoaded] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [userMovedMap, setUserMovedMap] = useState(false);
  const isInitialLoadRef = useRef(true);

  const [nearbyStations, setNearbyStations] = useState<NearbyStation[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [searchRadius, setSearchRadius] = useState(500);

  const [selectedStation, setSelectedStation] = useState<StationInfo | null>(null);
  const [stationArrivals, setStationArrivals] = useState<RealtimeArrivalInfo[]>([]);
  const [loadingArrivals, setLoadingArrivals] = useState(false);
  const [stationCountdown, setStationCountdown] = useState(15);
  const stationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [selectedBus, setSelectedBus] = useState<BusLaneInfo | null>(null);
  const [busRouteStations, setBusRouteStations] = useState<BusStationInfo[]>([]);
  const [busPositions, setBusPositions] = useState<BusPosition[]>([]);
  const [loadingBusRoute, setLoadingBusRoute] = useState(false);

  const [trackingTargets, setTrackingTargets] = useState<TrackingTargetWithArrival[]>([]);
  const [loadingTracking, setLoadingTracking] = useState(false);
  const [stationTrackingBusIds, setStationTrackingBusIds] = useState<string[]>([]);

  const [searchHistory, setSearchHistory] = useState<SearchHistoryItem[]>([]);
  const [favoriteStations, setFavoriteStations] = useState<FavoriteStation[]>([]);
  const [favoriteRoutes, setFavoriteRoutes] = useState<FavoriteRoute[]>([]);
  const [user, setUser] = useState<{ id: string } | null>(null);

  // Mobile UI states
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
    
    const saved = localStorage.getItem('bus_search_history');
    if (saved) {
      try {
        setSearchHistory(JSON.parse(saved));
      } catch {
        setSearchHistory([]);
      }
    }
  }, []);

  const addToHistory = useCallback((item: Omit<SearchHistoryItem, 'timestamp'>) => {
    setSearchHistory((prev) => {
      const filtered = prev.filter((h) => !(h.type === item.type && h.id === item.id));
      const newHistory = [{ ...item, timestamp: Date.now() }, ...filtered].slice(0, 20);
      localStorage.setItem('bus_search_history', JSON.stringify(newHistory));
      return newHistory;
    });
  }, []);

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

        const dragendHandler = () => {
          const center = map.getCenter();
          setMapCenter({ lat: center.getLat(), lng: center.getLng() });
          setUserMovedMap(true);
        };
        kakao.maps.event.addListener(map, 'dragend', dragendHandler);
        dragendListenerRef.current = dragendHandler;

        // 줌 컨트롤 추가
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const zoomControl = new (kakao.maps as any).ZoomControl();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (map as any).addControl(zoomControl, (kakao.maps as any).ControlPosition.RIGHT);

        setMapLoaded(true);
      } catch (err) {
        console.error('Map init error:', err);
      }
    }
    initMap();

    // Cleanup: 이벤트 리스너 제거
    return () => {
      if (mapInstanceRef.current && dragendListenerRef.current) {
        const kakao = window.kakao;
        if (kakao?.maps?.event?.removeListener) {
          kakao.maps.event.removeListener(mapInstanceRef.current, 'dragend', dragendListenerRef.current);
        }
      }
      // 마커 정리
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      if (radiusCircleRef.current) radiusCircleRef.current.setMap(null);
      if (polylineRef.current) polylineRef.current.setMap(null);
    };
  }, []);

  const fetchNearbyStations = useCallback(async (center?: { lat: number; lng: number }, radius?: number) => {
    const searchCenter = center || mapCenter || currentLocation;
    const searchRadiusValue = radius || searchRadius;
    if (!searchCenter) return;

    setLoadingNearby(true);
    try {
      const response = await fetch(
        `/api/bus/station/nearby?x=${searchCenter.lng}&y=${searchCenter.lat}&radius=${searchRadiusValue}`
      );
      const data = await response.json();
      const stations = data.stations || [];
      setNearbyStations(stations);
      
      if (mapInstanceRef.current) {
        markersRef.current.forEach((m) => m.setMap(null));
        markersRef.current = [];
        if (radiusCircleRef.current) radiusCircleRef.current.setMap(null);
        if (centerMarkerRef.current) centerMarkerRef.current.setMap(null);

        const kakao = window.kakao;
        const map = mapInstanceRef.current;
        const centerPosition = new kakao.maps.LatLng(searchCenter.lat, searchCenter.lng);

        const circle = new kakao.maps.Circle({
          center: centerPosition,
          radius: searchRadiusValue,
          strokeWeight: 2,
          strokeColor: '#3B82F6',
          strokeOpacity: 0.8,
          strokeStyle: 'dashed',
          fillColor: '#3B82F6',
          fillOpacity: 0.1,
        });
        circle.setMap(map);
        radiusCircleRef.current = circle;

        stations.forEach((station: NearbyStation, idx: number) => {
          const position = new kakao.maps.LatLng(parseFloat(station.y), parseFloat(station.x));
          const content = document.createElement('div');
          content.innerHTML = `
            <div style="
              width: 32px; height: 32px;
              background: #10B981;
              border: 2px solid white;
              border-radius: 50%;
              display: flex; align-items: center; justify-content: center;
              font-size: 12px; font-weight: bold; color: white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            ">${idx + 1}</div>
          `;
          
          content.addEventListener('click', () => handleSelectStation(station));

          const overlay = new kakao.maps.CustomOverlay({
            position,
            content,
            yAnchor: 0.5,
            zIndex: 1,
          });
          overlay.setMap(map);
          markersRef.current.push(overlay);
        });
      }
    } catch (error) {
      console.error('Fetch nearby stations error:', error);
    } finally {
      setLoadingNearby(false);
    }
  }, [mapCenter, currentLocation, searchRadius]);

  const fetchStationArrivals = async (stationId: string, arsId?: string) => {
    if (!stationId && !arsId) return;
    setLoadingArrivals(true);
    try {
      const params = new URLSearchParams();
      if (stationId) params.append('stationId', stationId);
      if (arsId) params.append('arsId', arsId);

      const response = await fetch(`/api/bus/arrival?${params.toString()}`);
      const data = await response.json();
      
      interface ArrivalApiItem {
        routeId?: string;
        routeName: string;
        routeType: number;
        predictTimeSec1?: number;
        locationNo1?: number;
        plateNo1?: string;
        remainSeat1?: number;
        lowPlate1?: number;
        crowded1?: number;
        predictTimeSec2?: number;
        locationNo2?: number;
        plateNo2?: string;
        remainSeat2?: number;
        lowPlate2?: number;
        crowded2?: number;
      }
      const arrivals: RealtimeArrivalInfo[] = (data.arrivals || []).map((item: ArrivalApiItem) => ({
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
      if (user && stationId) fetchStationTrackingTargets(stationId);
    } catch (error) {
      console.error('Fetch arrivals error:', error);
      setStationArrivals([]);
    } finally {
      setLoadingArrivals(false);
    }
  };

  const fetchBusRoute = async (bus: BusLaneInfo) => {
    setLoadingBusRoute(true);
    try {
      const response = await fetch(`/api/bus/route?routeId=${bus.busID}&busNo=${encodeURIComponent(bus.busNo)}`);
      const data = await response.json();

      if (data.routeInfo) {
        // API 응답 필드명을 BusLaneInfo 필드명으로 매핑
        const routeInfo = data.routeInfo;
        setSelectedBus(prev => ({
          ...prev,
          ...bus,
          busStartPoint: routeInfo.startStation || bus.busStartPoint,
          busEndPoint: routeInfo.endStation || bus.busEndPoint,
          busFirstTime: routeInfo.firstTime || bus.busFirstTime,
          busLastTime: routeInfo.lastTime || bus.busLastTime,
          busInterval: routeInfo.interval || bus.busInterval,
        }));
      } else {
        setSelectedBus(bus);
      }

      const stations: BusStationInfo[] = data.stations || [];
      // API 응답의 busStationSeq를 stationSeq에도 매핑
      const rawPositions = data.realtime || [];
      const positions: BusPosition[] = rawPositions.map((p: { busStationSeq: number; plateNo: string; lowPlate?: boolean; crowded?: number; direction?: number }) => ({
        ...p,
        stationSeq: p.busStationSeq,
      }));
      console.log('[BusRoute] API Response - stations:', stations.length, 'realtime:', positions.length);
      console.log('[BusRoute] Station idx values:', stations.slice(0, 5).map(s => ({ name: s.stationName, idx: s.idx })));
      console.log('[BusRoute] Bus positions:', positions);
      setBusRouteStations(stations);
      setBusPositions(positions);

      if (mapInstanceRef.current && stations.length > 0) {
        const kakao = window.kakao;
        const map = mapInstanceRef.current;

        // 기존 마커 정리
        busMarkersRef.current.forEach((m) => m.setMap(null));
        busMarkersRef.current = [];
        stationMarkersRef.current.forEach((m) => m.setMap(null));
        stationMarkersRef.current = [];
        if (polylineRef.current) polylineRef.current.setMap(null);

        // 노선 폴리라인 그리기
        const path = stations.map((s: BusStationInfo) => new kakao.maps.LatLng(parseFloat(s.y), parseFloat(s.x)));
        const polyline = new kakao.maps.Polyline({
          path,
          strokeWeight: 5,
          strokeColor: '#3B82F6',
          strokeOpacity: 0.8,
          strokeStyle: 'solid',
        });
        polyline.setMap(map);
        polylineRef.current = polyline;

        // 정류소 마커 표시 (기점/종점)
        const firstStation = stations[0];
        const lastStation = stations[stations.length - 1];

        if (firstStation) {
          const firstContent = document.createElement('div');
          firstContent.innerHTML = `
            <div style="
              padding: 6px 10px;
              background: #10B981;
              border-radius: 16px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              white-space: nowrap;
            ">
              <span style="color: white; font-size: 12px; font-weight: 600;">🚏 ${firstStation.stationName}</span>
            </div>
          `;
          const firstOverlay = new kakao.maps.CustomOverlay({
            position: new kakao.maps.LatLng(parseFloat(firstStation.y), parseFloat(firstStation.x)),
            content: firstContent,
            yAnchor: 1.5,
          });
          firstOverlay.setMap(map);
          stationMarkersRef.current.push(firstOverlay);
        }

        if (lastStation) {
          const lastContent = document.createElement('div');
          lastContent.innerHTML = `
            <div style="
              padding: 6px 10px;
              background: #EF4444;
              border-radius: 16px;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              white-space: nowrap;
            ">
              <span style="color: white; font-size: 12px; font-weight: 600;">🏁 ${lastStation.stationName}</span>
            </div>
          `;
          const lastOverlay = new kakao.maps.CustomOverlay({
            position: new kakao.maps.LatLng(parseFloat(lastStation.y), parseFloat(lastStation.x)),
            content: lastContent,
            yAnchor: 1.5,
          });
          lastOverlay.setMap(map);
          stationMarkersRef.current.push(lastOverlay);
        }

        // 버스 위치 마커 표시
        console.log('[BusRoute] Displaying bus positions:', positions.length, 'buses');
        positions.forEach((pos, posIdx) => {
          // 정류소 순번(idx)으로 매칭 (배열 인덱스가 아닌 실제 순번)
          const station = stations.find(s => s.idx === pos.busStationSeq);
          console.log(`[BusRoute] Bus ${posIdx}: seq=${pos.busStationSeq}, found station:`, station?.stationName);
          if (station) {
            const position = new kakao.maps.LatLng(parseFloat(station.y), parseFloat(station.x));

            // 방향 결정: direction 0=종점방향, 1=기점방향
            const hasDirection = pos.direction !== undefined && pos.direction !== null;
            const isOutbound = pos.direction === 0;
            const isInbound = pos.direction === 1;

            let directionLabel = '';
            let directionColor = '#6B7280';

            if (hasDirection) {
              if (isOutbound) {
                directionLabel = '▶ 종점방향';
                directionColor = '#3B82F6';
              } else if (isInbound) {
                directionLabel = '◀ 기점방향';
                directionColor = '#F97316';
              }
            }

            const gradientEnd = isOutbound ? '#1D4ED8' : isInbound ? '#EA580C' : '#4B5563';
            const shadowColor = isOutbound ? 'rgba(59,130,246,0.5)' : isInbound ? 'rgba(249,115,22,0.5)' : 'rgba(107,114,128,0.5)';
            const bgColor = isOutbound ? 'rgba(59,130,246,0.9)' : isInbound ? 'rgba(249,115,22,0.9)' : 'rgba(107,114,128,0.9)';

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
                  background: linear-gradient(135deg, ${directionColor} 0%, ${gradientEnd} 100%);
                  border: 3px solid white;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  box-shadow: 0 4px 12px ${shadowColor};
                ">
                  <span style="font-size: 16px;">🚌</span>
                </div>
                ${directionLabel ? `
                <div style="
                  margin-top: 4px;
                  padding: 2px 6px;
                  background: ${bgColor};
                  border-radius: 4px;
                  white-space: nowrap;
                ">
                  <span style="color: white; font-size: 10px; font-weight: 500;">
                    ${directionLabel}
                  </span>
                </div>
                ` : ''}
                <div style="
                  margin-top: ${directionLabel ? '2px' : '4px'};
                  padding: 2px 6px;
                  background: rgba(0,0,0,0.75);
                  border-radius: 4px;
                  white-space: nowrap;
                ">
                  <span style="color: white; font-size: 10px; font-weight: 500;">
                    ${pos.plateNo || '운행중'}${pos.lowPlate ? ' 🦽' : ''}
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

        const bounds = new kakao.maps.LatLngBounds();
        path.forEach((p: KakaoLatLng) => bounds.extend(p));
        map.setBounds(bounds);
      }
    } catch (error) {
      console.error('Bus route fetch error:', error);
    } finally {
      setLoadingBusRoute(false);
    }
  };

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
      console.error('Fetch tracking targets error:', error);
    }
  }, [user]);

  const handleSelectStation = (station: StationInfo | NearbyStationInfo | NearbyStation) => {
    const arsID = 'arsID' in station ? station.arsID : undefined;
    const stationInfo: StationInfo = {
      stationID: station.stationID,
      stationName: station.stationName,
      x: station.x,
      y: station.y,
      CID: 1,
      arsID,
    };

    setSelectedStation(stationInfo);
    setSelectedBus(null);
    setBusRouteStations([]);
    setActiveTab('station');
    
    addToHistory({
      type: 'station',
      id: station.stationID,
      name: station.stationName,
      x: station.x,
      y: station.y,
      arsID: stationInfo.arsID,
    });

    if (mapInstanceRef.current) {
      const kakao = window.kakao;
      const position = new kakao.maps.LatLng(parseFloat(station.y), parseFloat(station.x));
      mapInstanceRef.current.panTo(position);
    }

    fetchStationArrivals(station.stationID, stationInfo.arsID);
  };

  const handleSelectBus = (bus: BusLaneInfo) => {
    setSelectedBus(bus);
    setSelectedStation(null);
    setStationArrivals([]);
    setActiveTab('route');
    
    addToHistory({
      type: 'bus',
      id: bus.busID,
      name: bus.busNo,
      subInfo: bus.busStartPoint && bus.busEndPoint ? `${bus.busStartPoint} → ${bus.busEndPoint}` : undefined,
    });

    fetchBusRoute(bus);
  };

  const handleBusFromArrival = async (arrival: RealtimeArrivalInfo) => {
    try {
      const response = await fetch(`/api/bus/search?q=${encodeURIComponent(arrival.routeNm)}`);
      const data = await response.json();
      const buses: BusLaneInfo[] = data.buses || [];
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

  const handleTrackingToggle = async (busId: string, busNo: string) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    if (!selectedStation) return;

    const isTracking = stationTrackingBusIds.includes(busId);
    try {
      if (isTracking) {
        const response = await fetch('/api/tracking/targets');
        const data = await response.json();
        const target = data.targets?.find(
          (t: TrackingTarget) => t.bus_id === busId && t.station_id === selectedStation.stationID
        );
        if (target) {
          await fetch(`/api/tracking/targets?id=${target.id}`, { method: 'DELETE' });
        }
      } else {
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
      fetchStationTrackingTargets(selectedStation.stationID);
    } catch (error) {
      console.error('Toggle tracking error:', error);
    }
  };

  const handleFavoriteToggle = async (type: 'station' | 'route', item: StationInfo | BusLaneInfo) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (type === 'station' && 'stationID' in item) {
      const stationItem = item as StationInfo;
      const isFav = favoriteStations.some(s => s.station_id === stationItem.stationID);
      if (isFav) {
        await fetch(`/api/favorites/stations?stationId=${stationItem.stationID}`, { method: 'DELETE' });
        setFavoriteStations(prev => prev.filter(s => s.station_id !== stationItem.stationID));
      } else {
        const res = await fetch('/api/favorites/stations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            station_id: stationItem.stationID,
            station_name: stationItem.stationName,
            x: stationItem.x,
            y: stationItem.y,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setFavoriteStations(prev => [...prev, data.station]);
        }
      }
    } else if (type === 'route' && 'busID' in item) {
      const busItem = item as BusLaneInfo;
      const isFav = favoriteRoutes.some(r => r.bus_id === busItem.busID);
      if (isFav) {
        await fetch(`/api/favorites/routes?busId=${busItem.busID}`, { method: 'DELETE' });
        setFavoriteRoutes(prev => prev.filter(r => r.bus_id !== busItem.busID));
      } else {
        const res = await fetch('/api/favorites/routes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bus_id: busItem.busID,
            bus_no: busItem.busNo,
            bus_type: busItem.type,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setFavoriteRoutes(prev => [...prev, data.route]);
        }
      }
    }
  };

  // 탭 전환 시 지도 오버레이 정리
  useEffect(() => {
    if (activeTab !== 'station') {
      // 정류소 탭이 아닐 때 주변 정류소 마커와 반경 원 숨기기
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      if (radiusCircleRef.current) {
        radiusCircleRef.current.setMap(null);
        radiusCircleRef.current = null;
      }
      if (centerMarkerRef.current) {
        centerMarkerRef.current.setMap(null);
        centerMarkerRef.current = null;
      }
      setNearbyStations([]);
    }
    if (activeTab !== 'route') {
      // 노선 탭이 아닐 때 노선 관련 오버레이 숨기기
      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }
      busMarkersRef.current.forEach((m) => m.setMap(null));
      busMarkersRef.current = [];
      stationMarkersRef.current.forEach((m) => m.setMap(null));
      stationMarkersRef.current = [];
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'station' && mapCenter && !selectedStation) {
      if (isInitialLoadRef.current || userMovedMap) {
        fetchNearbyStations();
        isInitialLoadRef.current = false;
        setUserMovedMap(false);
      }
    }
  }, [activeTab, mapCenter, selectedStation, userMovedMap, fetchNearbyStations]);

  useEffect(() => {
    if (activeTab !== 'station' || !selectedStation) {
      if (stationIntervalRef.current) clearInterval(stationIntervalRef.current);
      return;
    }

    setStationCountdown(15);
    stationIntervalRef.current = setInterval(() => {
      setStationCountdown(prev => {
        if (prev <= 1) {
          fetchStationArrivals(selectedStation.stationID, selectedStation.arsID);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (stationIntervalRef.current) clearInterval(stationIntervalRef.current);
    };
  }, [activeTab, selectedStation]);

  const renderContent = () => (
    <div className="space-y-4">
      {activeTab === 'station' && (
        <StationSearchInput
          onSelect={handleSelectStation}
          placeholder="정류소명을 입력하세요"
          className="mb-4"
        />
      )}
      {activeTab === 'route' && !selectedBus && (
        <BusSearchInput
          onSelect={handleSelectBus}
          placeholder="버스 번호를 입력하세요"
          className="mb-4"
        />
      )}

      {selectedBus && activeTab === 'route' && (
        <BusRouteDetail
          bus={selectedBus}
          stations={busRouteStations}
          realtimePositions={busPositions}
          isFavorite={favoriteRoutes.some(r => r.bus_id === selectedBus.busID)}
          onToggleFavorite={() => handleFavoriteToggle('route', selectedBus)}
          onClose={() => {
            setSelectedBus(null);
            setBusRouteStations([]);
            if (polylineRef.current) polylineRef.current.setMap(null);
          }}
        />
      )}

      {selectedStation && activeTab === 'station' && (
        <div className="space-y-4">
          <div className="p-4 bg-white/50 dark:bg-black/20 backdrop-blur-sm rounded-lg border border-border">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{selectedStation.stationName}</h3>
                <p className="text-sm text-muted-foreground">
                  ID: {selectedStation.stationID}
                  {selectedStation.arsID && ` · ${selectedStation.arsID}`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleFavoriteToggle('station', selectedStation)}
                >
                  {favoriteStations.some(s => s.station_id === selectedStation.stationID) ? '⭐' : '☆'}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setSelectedStation(null)}>✕</Button>
              </div>
            </div>
          </div>

          <StationArrivals
            arrivals={stationArrivals}
            loading={loadingArrivals}
            countdown={stationCountdown}
            trackingBusIds={stationTrackingBusIds}
            onRefresh={() => fetchStationArrivals(selectedStation.stationID, selectedStation.arsID)}
            onBusClick={(arrival) => handleBusFromArrival(arrival)}
            onTrackingToggle={handleTrackingToggle}
          />
        </div>
      )}

      {!selectedStation && activeTab === 'station' && (
        <>
          <NearbyStations
            stations={nearbyStations}
            loading={loadingNearby}
            searchRadius={searchRadius}
            hasMapCenter={!!mapCenter}
            onStationClick={handleSelectStation}
            onRadiusChange={setSearchRadius}
            onRefresh={() => fetchNearbyStations()}
          />
          {/* 최근 검색 - 정류소 */}
          {searchHistory.filter(h => h.type === 'station').length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">최근 검색</span>
                <button
                  onClick={() => {
                    const newHistory = searchHistory.filter(h => h.type !== 'station');
                    setSearchHistory(newHistory);
                    localStorage.setItem('bus_search_history', JSON.stringify(newHistory));
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  전체 삭제
                </button>
              </div>
              <div className="space-y-1">
                {searchHistory.filter(h => h.type === 'station').slice(0, 5).map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 group"
                  >
                    <button
                      onClick={() => handleSelectStation({
                        stationID: item.id,
                        stationName: item.name,
                        x: item.x || '',
                        y: item.y || '',
                        CID: 1,
                        arsID: item.arsID,
                      })}
                      className="flex-1 text-left text-sm truncate"
                    >
                      {item.name}
                    </button>
                    <button
                      onClick={() => {
                        const newHistory = searchHistory.filter(h => !(h.type === item.type && h.id === item.id));
                        setSearchHistory(newHistory);
                        localStorage.setItem('bus_search_history', JSON.stringify(newHistory));
                      }}
                      className="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="text-muted-foreground text-xs">✕</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 최근 검색 - 노선 (버스 미선택 시) */}
      {!selectedBus && activeTab === 'route' && searchHistory.filter(h => h.type === 'bus').length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-muted-foreground">최근 검색</span>
            <button
              onClick={() => {
                const newHistory = searchHistory.filter(h => h.type !== 'bus');
                setSearchHistory(newHistory);
                localStorage.setItem('bus_search_history', JSON.stringify(newHistory));
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              전체 삭제
            </button>
          </div>
          <div className="space-y-1">
            {searchHistory.filter(h => h.type === 'bus').slice(0, 10).map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50 group"
              >
                <button
                  onClick={() => handleSelectBus({
                    busID: item.id,
                    busNo: item.name,
                    type: 0,
                    busStartPoint: item.subInfo?.split(' → ')[0] || '',
                    busEndPoint: item.subInfo?.split(' → ')[1] || '',
                  } as BusLaneInfo)}
                  className="flex-1 text-left min-w-0"
                >
                  <span className="text-sm font-medium">{item.name}</span>
                  {item.subInfo && (
                    <p className="text-xs text-muted-foreground truncate">{item.subInfo}</p>
                  )}
                </button>
                <button
                  onClick={() => {
                    const newHistory = searchHistory.filter(h => !(h.type === item.type && h.id === item.id));
                    setSearchHistory(newHistory);
                    localStorage.setItem('bus_search_history', JSON.stringify(newHistory));
                  }}
                  className="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <span className="text-muted-foreground text-xs">✕</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative h-[calc(100vh-3rem)] overflow-hidden">
      <div ref={mapRef} className="absolute inset-0 z-0" />

      <div className="hidden md:block absolute left-0 top-0 bottom-0 z-10">
        <BusSidebar>
          <div className="flex gap-2 mb-4">
            {['station', 'route', 'search', 'tracking'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as TabType)}
                className={cn(
                  "flex-1 py-2 text-sm font-medium rounded-lg transition-colors",
                  activeTab === tab 
                    ? "bg-primary text-primary-foreground" 
                    : "bg-muted text-muted-foreground hover:bg-accent"
                )}
              >
                {tab === 'station' ? '정류소' : 
                 tab === 'route' ? '노선' : 
                 tab === 'search' ? '길찾기' : '추적'}
              </button>
            ))}
          </div>
          {renderContent()}
        </BusSidebar>
      </div>

      {/* Mobile UI */}
      <div className="md:hidden">
        {/* Show bottom sheet when nothing is selected */}
        {!selectedStation && !selectedBus && (
          <MobileBottomSheet
            mode={activeTab === 'route' ? 'bus' : activeTab === 'search' ? 'search' : activeTab === 'tracking' ? 'tracking' : 'station'}
            onModeChange={(mode) => {
              const tabMap: Record<string, TabType> = { station: 'station', bus: 'route', search: 'search', tracking: 'tracking' };
              setActiveTab(tabMap[mode] || 'station');
            }}
            onSearchFocus={() => setMobileSearchOpen(true)}
            onCurrentLocation={() => {
              if (currentLocation && mapInstanceRef.current) {
                const kakao = window.kakao;
                mapInstanceRef.current.panTo(new kakao.maps.LatLng(currentLocation.lat, currentLocation.lng));
                setMapCenter(currentLocation);
                fetchNearbyStations(currentLocation);
              }
            }}
            nearbyStations={nearbyStations}
            loadingNearby={loadingNearby}
            searchRadius={searchRadius}
            onRadiusChange={(radius) => {
              setSearchRadius(radius);
              fetchNearbyStations(mapCenter || currentLocation || undefined, radius);
            }}
            onRefreshNearby={() => fetchNearbyStations()}
            onStationSelect={(station) => {
              handleSelectStation({
                stationID: station.stationID,
                stationName: station.stationName,
                x: station.x,
                y: station.y,
                CID: 1,
                arsID: station.arsID,
              });
            }}
            searchHistory={searchHistory}
            onHistorySelect={(item) => {
              if (item.type === 'station') {
                handleSelectStation({
                  stationID: item.id,
                  stationName: item.name,
                  x: item.x || '',
                  y: item.y || '',
                  CID: 1,
                  arsID: item.arsID,
                });
              } else {
                handleSelectBus({
                  busID: item.id,
                  busNo: item.name,
                  type: 0,
                  busStartPoint: item.subInfo?.split(' → ')[0] || '',
                  busEndPoint: item.subInfo?.split(' → ')[1] || '',
                } as BusLaneInfo);
              }
            }}
            onRemoveHistoryItem={(type, id) => {
              setSearchHistory(prev => {
                const newHistory = prev.filter(h => !(h.type === type && h.id === id));
                localStorage.setItem('bus_search_history', JSON.stringify(newHistory));
                return newHistory;
              });
            }}
            onClearHistory={() => {
              setSearchHistory([]);
              localStorage.removeItem('bus_search_history');
            }}
          />
        )}

        {/* Info card when station or bus is selected */}
        {selectedStation && !mobileDetailOpen && (
          <MobileInfoCard
            type="station"
            station={selectedStation}
            arrivals={stationArrivals}
            loadingArrivals={loadingArrivals}
            isFavorite={favoriteStations.some(s => s.station_id === selectedStation.stationID)}
            onExpand={() => setMobileDetailOpen(true)}
            onClose={() => {
              setSelectedStation(null);
              setStationArrivals([]);
            }}
            onToggleFavorite={() => handleFavoriteToggle('station', selectedStation)}
            onRefresh={() => fetchStationArrivals(selectedStation.stationID, selectedStation.arsID)}
            onBusClick={handleBusFromArrival}
          />
        )}

        {selectedBus && !mobileDetailOpen && (
          <MobileInfoCard
            type="bus"
            bus={selectedBus}
            isFavorite={favoriteRoutes.some(r => r.bus_id === selectedBus.busID)}
            onExpand={() => setMobileDetailOpen(true)}
            onClose={() => {
              setSelectedBus(null);
              setBusRouteStations([]);
              if (polylineRef.current) polylineRef.current.setMap(null);
            }}
            onToggleFavorite={() => handleFavoriteToggle('route', selectedBus)}
          />
        )}

        {/* Search overlay */}
        <MobileSearchOverlay
          isOpen={mobileSearchOpen}
          mode={activeTab === 'route' ? 'bus' : activeTab === 'search' ? 'search' : activeTab === 'tracking' ? 'tracking' : 'station'}
          onClose={() => setMobileSearchOpen(false)}
          onSelectStation={handleSelectStation}
          onSelectBus={handleSelectBus}
          nearbyStations={nearbyStations}
          loadingNearby={loadingNearby}
          searchRadius={searchRadius}
          onRadiusChange={(radius) => {
            setSearchRadius(radius);
            fetchNearbyStations(mapCenter || currentLocation || undefined, radius);
          }}
          onRefreshNearby={() => fetchNearbyStations()}
          searchHistory={searchHistory}
          onClearHistory={() => {
            setSearchHistory([]);
            localStorage.removeItem('bus_search_history');
          }}
          onRemoveHistoryItem={(type, id) => {
            setSearchHistory(prev => {
              const newHistory = prev.filter(h => !(h.type === type && h.id === id));
              localStorage.setItem('bus_search_history', JSON.stringify(newHistory));
              return newHistory;
            });
          }}
          trackingTargets={trackingTargets}
          loadingTracking={loadingTracking}
          onRemoveTracking={async (id) => {
            try {
              await fetch(`/api/tracking/targets?id=${id}`, { method: 'DELETE' });
              setTrackingTargets(prev => prev.filter(t => t.id !== id));
            } catch (error) {
              console.error('Remove tracking error:', error);
            }
          }}
        />

        {/* Detail panel */}
        <MobileDetailPanel
          isOpen={mobileDetailOpen}
          type={selectedStation ? 'station' : 'bus'}
          station={selectedStation}
          bus={selectedBus}
          arrivals={stationArrivals}
          busStations={busRouteStations}
          busPositions={busPositions}
          loadingArrivals={loadingArrivals}
          loadingBusRoute={loadingBusRoute}
          countdown={stationCountdown}
          isFavorite={
            selectedStation
              ? favoriteStations.some(s => s.station_id === selectedStation.stationID)
              : selectedBus
              ? favoriteRoutes.some(r => r.bus_id === selectedBus.busID)
              : false
          }
          trackingBusIds={stationTrackingBusIds}
          onClose={() => setMobileDetailOpen(false)}
          onToggleFavorite={() => {
            if (selectedStation) handleFavoriteToggle('station', selectedStation);
            else if (selectedBus) handleFavoriteToggle('route', selectedBus);
          }}
          onRefresh={() => {
            if (selectedStation) fetchStationArrivals(selectedStation.stationID, selectedStation.arsID);
          }}
          onBusClick={handleBusFromArrival}
          onTrackingToggle={handleTrackingToggle}
          onStationClick={(station) => {
            const stationInfo: StationInfo = {
              stationID: station.stationID,
              stationName: station.stationName,
              x: station.x,
              y: station.y,
              CID: 1,
            };
            handleSelectStation(stationInfo);
            setMobileDetailOpen(false);
          }}
        />
      </div>
    </div>
  );
}

export default function BusPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>}>
      <BusPageContent />
    </Suspense>
  );
}
