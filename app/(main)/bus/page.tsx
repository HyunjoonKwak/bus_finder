'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { StationSearchInput } from '@/components/station/StationSearchInput';
import { BusSearchInput } from '@/components/bus/BusSearchInput';
import { loadKakaoMapScript, getCurrentPosition } from '@/lib/kakao';
import { cn } from '@/lib/utils';
import type { StationInfo, NearbyStationInfo, BusLaneInfo, BusStationInfo, RealtimeArrivalInfo } from '@/lib/odsay/types';
import { createClient } from '@/lib/supabase/client';
import { useSearchStore } from '@/lib/store';
import { BusSidebar } from '@/components/bus/BusSidebar';
import { BusRouteDetail } from '@/components/bus/BusRouteDetail';
import { StationArrivals } from '@/components/station/StationArrivals';
import { NearbyStations, NearbyStation } from '@/components/station/NearbyStations';
import { MobileSearchBar } from '@/components/mobile/MobileSearchBar';
import { MobileSearchOverlay } from '@/components/mobile/MobileSearchOverlay';
import { MobileInfoCard } from '@/components/mobile/MobileInfoCard';
import { MobileDetailPanel } from '@/components/mobile/MobileDetailPanel';

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

interface RouteResult {
  id: string;
  origin: { name: string; x?: number; y?: number };
  destination: { name: string; x?: number; y?: number };
  totalTime: number;
  totalDistance?: number;
  walkTime: number;
  transferCount: number;
  fare: number;
  legs: any[];
  pathType?: number;
}

import { MapControls } from '@/components/map/MapControls';

function BusPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const polylineRef = useRef<any>(null);
  const radiusCircleRef = useRef<any>(null);
  const centerMarkerRef = useRef<any>(null);

  const tabParam = searchParams.get('tab') as TabType | null;
  const initialTab = tabParam && ['station', 'route', 'search', 'tracking'].includes(tabParam) ? tabParam : 'station';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const [mapLoaded, setMapLoaded] = useState(false);
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
  const [busPositions, setBusPositions] = useState<any[]>([]);
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

        kakao.maps.event.addListener(map, 'dragend', () => {
          const center = map.getCenter();
          setMapCenter({ lat: center.getLat(), lng: center.getLng() });
          setUserMovedMap(true);
        });

        setMapLoaded(true);
      } catch (err) {
        console.error('Map init error:', err);
      }
    }
    initMap();
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
        setSelectedBus(prev => prev ? ({ ...prev, ...data.routeInfo }) : data.routeInfo);
      }
      
      setBusRouteStations(data.stations || []);
      setBusPositions(data.realtime || []);
      
      if (mapInstanceRef.current && data.stations?.length > 0) {
        const kakao = window.kakao;
        const map = mapInstanceRef.current;
        const path = data.stations.map((s: any) => new kakao.maps.LatLng(parseFloat(s.y), parseFloat(s.x)));
        
        if (polylineRef.current) polylineRef.current.setMap(null);
        
        const polyline = new kakao.maps.Polyline({
          path,
          strokeWeight: 5,
          strokeColor: '#3B82F6',
          strokeOpacity: 0.8,
          strokeStyle: 'solid',
        });
        polyline.setMap(map);
        polylineRef.current = polyline;
        
        const bounds = new kakao.maps.LatLngBounds();
        path.forEach((p: any) => bounds.extend(p));
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
    const arsID = (station as any).arsID || (station as any).arsId;
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

  const handleFavoriteToggle = async (type: 'station' | 'route', item: any) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }

    if (type === 'station') {
      const isFav = favoriteStations.some(s => s.station_id === item.stationID);
      if (isFav) {
        await fetch(`/api/favorites/stations?stationId=${item.stationID}`, { method: 'DELETE' });
        setFavoriteStations(prev => prev.filter(s => s.station_id !== item.stationID));
      } else {
        const res = await fetch('/api/favorites/stations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            station_id: item.stationID,
            station_name: item.stationName,
            x: item.x,
            y: item.y,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setFavoriteStations(prev => [...prev, data.station]);
        }
      }
    } else {
      const isFav = favoriteRoutes.some(r => r.bus_id === item.busID);
      if (isFav) {
        await fetch(`/api/favorites/routes?busId=${item.busID}`, { method: 'DELETE' });
        setFavoriteRoutes(prev => prev.filter(r => r.bus_id !== item.busID));
      } else {
        const res = await fetch('/api/favorites/routes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bus_id: item.busID,
            bus_no: item.busNo,
            bus_type: item.type,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setFavoriteRoutes(prev => [...prev, data.route]);
        }
      }
    }
  };

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
        <NearbyStations
          stations={nearbyStations}
          loading={loadingNearby}
          searchRadius={searchRadius}
          hasMapCenter={!!mapCenter}
          onStationClick={handleSelectStation}
          onRadiusChange={setSearchRadius}
          onRefresh={() => fetchNearbyStations()}
        />
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
        {/* Show search bar when nothing is selected */}
        {!selectedStation && !selectedBus && (
          <MobileSearchBar
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
          onRadiusChange={setSearchRadius}
          onRefreshNearby={() => fetchNearbyStations()}
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
