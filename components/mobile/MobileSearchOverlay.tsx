'use client';

import { useState } from 'react';
import { ArrowLeft, MapPin, RefreshCw, Bell, BellOff } from 'lucide-react';
import { StationSearchInput } from '@/components/station/StationSearchInput';
import { BusSearchInput } from '@/components/bus/BusSearchInput';
import { Badge } from '@/components/ui/badge';
import type { StationInfo, BusLaneInfo, RealtimeArrivalInfo } from '@/lib/odsay/types';
import { cn } from '@/lib/utils';
import { getBusTypeStyle } from '@/lib/bus-utils';
import type { NearbyStation } from '@/components/station/NearbyStations';

type SearchMode = 'station' | 'bus' | 'search' | 'tracking';

interface TrackingTarget {
  id: string;
  bus_id: string;
  bus_no: string;
  station_id: string;
  station_name: string;
  arrival?: {
    arrivalSec: number;
    leftStation: number;
  };
}

interface MobileSearchOverlayProps {
  isOpen: boolean;
  mode: SearchMode;
  onClose: () => void;
  onSelectStation: (station: StationInfo) => void;
  onSelectBus: (bus: BusLaneInfo) => void;
  // Nearby stations props
  nearbyStations?: NearbyStation[];
  loadingNearby?: boolean;
  searchRadius?: number;
  onRadiusChange?: (radius: number) => void;
  onRefreshNearby?: () => void;
  // Tracking props
  trackingTargets?: TrackingTarget[];
  loadingTracking?: boolean;
  onRemoveTracking?: (id: string) => void;
}

export function MobileSearchOverlay({
  isOpen,
  mode,
  onClose,
  onSelectStation,
  onSelectBus,
  nearbyStations = [],
  loadingNearby,
  searchRadius = 500,
  onRadiusChange,
  onRefreshNearby,
  trackingTargets = [],
  loadingTracking,
  onRemoveTracking,
}: MobileSearchOverlayProps) {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const formatArrivalTime = (seconds?: number) => {
    if (!seconds) return null;
    if (seconds < 60) return '곧 도착';
    const minutes = Math.floor(seconds / 60);
    return `${minutes}분`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border flex-shrink-0">
        <button
          onClick={onClose}
          className="p-2 -ml-1 rounded-full hover:bg-accent"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1">
          {mode === 'station' && (
            <StationSearchInput
              onSelect={(station) => {
                onSelectStation(station as StationInfo);
                onClose();
              }}
              placeholder="정류소명 또는 번호 입력"
              className="border-0 shadow-none bg-transparent"
            />
          )}
          {mode === 'bus' && (
            <BusSearchInput
              onSelect={(bus) => {
                onSelectBus(bus);
                onClose();
              }}
              placeholder="버스 번호 입력"
              className="border-0 shadow-none bg-transparent"
            />
          )}
          {mode === 'search' && (
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="목적지를 입력하세요"
              className="w-full px-3 py-2 bg-transparent outline-none"
              autoFocus
            />
          )}
          {mode === 'tracking' && (
            <div className="px-3 py-2 font-medium">
              추적 중인 버스
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Station mode - show nearby stations */}
        {mode === 'station' && (
          <div className="p-4">
            {/* Radius selector */}
            {onRadiusChange && (
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs text-muted-foreground whitespace-nowrap">반경</span>
                <div className="flex gap-1 flex-1">
                  {[300, 500, 1000].map((radius) => (
                    <button
                      key={radius}
                      onClick={() => onRadiusChange(radius)}
                      className={cn(
                        "flex-1 py-2 text-sm rounded-lg transition-colors",
                        searchRadius === radius
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent"
                      )}
                    >
                      {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Nearby stations header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <span className="font-medium">주변 정류소</span>
                {!loadingNearby && (
                  <span className="text-xs text-muted-foreground">({nearbyStations.length})</span>
                )}
              </div>
              {onRefreshNearby && (
                <button
                  onClick={onRefreshNearby}
                  className="p-2 rounded-full hover:bg-accent"
                  disabled={loadingNearby}
                >
                  <RefreshCw className={cn("w-4 h-4", loadingNearby && "animate-spin")} />
                </button>
              )}
            </div>

            {/* Nearby stations list */}
            {loadingNearby ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : nearbyStations.length > 0 ? (
              <div className="space-y-2">
                {nearbyStations.map((station, idx) => (
                  <button
                    key={station.stationID}
                    onClick={() => {
                      onSelectStation({
                        stationID: station.stationID,
                        stationName: station.stationName,
                        x: station.x,
                        y: station.y,
                        CID: 1,
                        arsID: station.arsID,
                      });
                      onClose();
                    }}
                    className="w-full p-3 text-left rounded-xl border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white bg-emerald-500">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{station.stationName}</p>
                        {station.arsID && (
                          <p className="text-xs text-muted-foreground">{station.arsID}</p>
                        )}
                      </div>
                      <Badge variant="secondary" className="flex-shrink-0">
                        {Math.round(station.distance)}m
                      </Badge>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">주변에 정류소가 없습니다</p>
                <p className="text-sm text-muted-foreground mt-1">지도를 이동해보세요</p>
              </div>
            )}
          </div>
        )}

        {/* Bus mode - search handles content */}
        {mode === 'bus' && (
          <div className="p-4 text-center text-muted-foreground">
            버스 번호를 입력하여 검색하세요
          </div>
        )}

        {/* Search mode */}
        {mode === 'search' && (
          <div className="p-4 text-center text-muted-foreground">
            길찾기 기능 준비 중
          </div>
        )}

        {/* Tracking mode */}
        {mode === 'tracking' && (
          <div className="p-4">
            {loadingTracking ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : trackingTargets.length > 0 ? (
              <div className="space-y-2">
                {trackingTargets.map((target) => (
                  <div
                    key={target.id}
                    className="p-4 rounded-xl border border-border bg-card"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn(
                        "px-2 py-1 rounded text-sm font-bold",
                        "bg-blue-500 text-white"
                      )}>
                        {target.bus_no}
                      </span>
                      {onRemoveTracking && (
                        <button
                          onClick={() => onRemoveTracking(target.id)}
                          className="p-2 rounded-full hover:bg-accent text-muted-foreground"
                        >
                          <BellOff className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {target.station_name}
                    </p>
                    {target.arrival ? (
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold text-primary">
                          {formatArrivalTime(target.arrival.arrivalSec)}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {target.arrival.leftStation}정거장 전
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">도착 정보 없음</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">추적 중인 버스가 없습니다</p>
                <p className="text-sm text-muted-foreground mt-1">
                  정류소에서 버스를 선택하여 추적을 시작하세요
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
