'use client';

import { useState } from 'react';
import { Search, MapPin, Bus, ChevronUp, ChevronDown, RefreshCw, Clock, X, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { NearbyStation } from '@/components/station/NearbyStations';
import type { RecentStation, RecentRoute } from '@/lib/store';

type SearchMode = 'station' | 'bus' | 'favorites';
type SheetState = 'collapsed' | 'half' | 'expanded';

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

interface MobileBottomSheetProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  onSearchFocus: () => void;
  onCurrentLocation: () => void;
  // Nearby stations
  nearbyStations: NearbyStation[];
  loadingNearby: boolean;
  searchRadius: number;
  onRadiusChange: (radius: number) => void;
  onRefreshNearby: () => void;
  onStationSelect: (station: NearbyStation) => void;
  // Recent history (Zustand store)
  recentStations: RecentStation[];
  recentRoutes: RecentRoute[];
  onRecentStationSelect: (station: RecentStation) => void;
  onRecentRouteSelect: (route: RecentRoute) => void;
  onRemoveRecentStation: (stationId: string) => void;
  onRemoveRecentRoute: (busId: string) => void;
  onClearRecentStations: () => void;
  onClearRecentRoutes: () => void;
  // Favorites
  favoriteStations?: FavoriteStation[];
  favoriteRoutes?: FavoriteRoute[];
  onFavoriteStationSelect?: (station: FavoriteStation) => void;
  onFavoriteRouteSelect?: (route: FavoriteRoute) => void;
  onRemoveFavoriteStation?: (stationId: string) => void;
  onRemoveFavoriteRoute?: (busId: string) => void;
}

export function MobileBottomSheet({
  mode,
  onModeChange,
  onSearchFocus,
  onCurrentLocation,
  nearbyStations,
  loadingNearby,
  searchRadius,
  onRadiusChange,
  onRefreshNearby,
  onStationSelect,
  recentStations,
  recentRoutes,
  onRecentStationSelect,
  onRecentRouteSelect,
  onRemoveRecentStation,
  onRemoveRecentRoute,
  onClearRecentStations,
  onClearRecentRoutes,
  favoriteStations = [],
  favoriteRoutes = [],
  onFavoriteStationSelect,
  onFavoriteRouteSelect,
  onRemoveFavoriteStation,
  onRemoveFavoriteRoute,
}: MobileBottomSheetProps) {
  const [sheetState, setSheetState] = useState<SheetState>('collapsed');

  const getPlaceholder = () => {
    switch (mode) {
      case 'station': return '정류소 검색';
      case 'bus': return '버스 번호 검색';
      case 'favorites': return '즐겨찾기';
    }
  };

  const toggleSheet = () => {
    setSheetState(prev => prev === 'collapsed' ? 'half' : 'collapsed');
  };

  // 모드에 따라 최근 검색 데이터 선택
  const currentRecentStations = recentStations.slice(0, 5);
  const currentRecentRoutes = recentRoutes.slice(0, 5);

  const sheetHeight = sheetState === 'collapsed'
    ? 'max-h-[140px]'
    : 'max-h-[60vh]';

  return (
    <div
      className={cn(
        "absolute bottom-0 left-0 right-0 z-20 bg-background rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] transition-all duration-300 ease-out",
        sheetHeight
      )}
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 8px)' }}
    >
      {/* Drag handle */}
      <div
        className="flex justify-center pt-2 pb-1 cursor-pointer"
        onClick={toggleSheet}
      >
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
      </div>

      <div className="px-3 overflow-hidden">
        {/* Mode selector pills */}
        <div className="flex gap-1.5 mb-2 overflow-x-auto scrollbar-hide">
          {([
            { id: 'station', label: '정류소', icon: MapPin },
            { id: 'bus', label: '노선', icon: Bus },
            { id: 'favorites', label: '즐겨찾기', icon: Star },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onModeChange(id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                mode === id
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Search bar row */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={onSearchFocus}
            className="flex-1 flex items-center gap-3 px-4 py-3 bg-muted rounded-xl"
          >
            <Search className="w-5 h-5 text-muted-foreground" />
            <span className="text-muted-foreground text-sm">{getPlaceholder()}</span>
          </button>

          <button
            onClick={onCurrentLocation}
            className="flex items-center justify-center w-12 h-12 bg-muted rounded-xl"
            aria-label="현재 위치"
          >
            <MapPin className="w-5 h-5 text-primary" />
          </button>

          <button
            onClick={toggleSheet}
            className="flex items-center justify-center w-12 h-12 bg-muted rounded-xl"
            aria-label={sheetState === 'collapsed' ? '펼치기' : '접기'}
          >
            {sheetState === 'collapsed' ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Expanded content */}
        {sheetState === 'half' && (
          <div className="overflow-y-auto max-h-[calc(60vh-160px)] pb-2">
            {/* Station mode content */}
            {mode === 'station' && (
              <>
                {/* Radius selector */}
                <div className="flex items-center gap-2 mb-3 py-2 border-t border-border">
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
                  <button
                    onClick={onRefreshNearby}
                    className="p-2 rounded-lg hover:bg-accent"
                    disabled={loadingNearby}
                  >
                    <RefreshCw className={cn("w-4 h-4", loadingNearby && "animate-spin")} />
                  </button>
                </div>

                {/* Nearby stations */}
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">주변 정류소</span>
                    {!loadingNearby && (
                      <span className="text-xs text-muted-foreground">({nearbyStations.length})</span>
                    )}
                  </div>

                  {loadingNearby ? (
                    <div className="flex justify-center py-6">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : nearbyStations.length > 0 ? (
                    <div className="space-y-1.5">
                      {nearbyStations.slice(0, 5).map((station, idx) => (
                        <button
                          key={station.stationID}
                          onClick={() => onStationSelect(station)}
                          className="w-full flex items-center gap-2 p-2.5 text-left rounded-lg hover:bg-accent/50 transition-colors"
                        >
                          <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-emerald-500">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{station.stationName}</p>
                          </div>
                          <Badge variant="secondary" className="flex-shrink-0 text-xs">
                            {Math.round(station.distance)}m
                          </Badge>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      주변에 정류소가 없습니다
                    </p>
                  )}
                </div>
              </>
            )}

            {/* History section - for both station and bus modes */}
            {/* 최근 검색 - 정류소 모드 */}
            {mode === 'station' && currentRecentStations.length > 0 && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">최근 검색</span>
                  </div>
                  <button
                    onClick={onClearRecentStations}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    전체 삭제
                  </button>
                </div>
                <div className="space-y-1">
                  {currentRecentStations.map((station) => (
                    <div
                      key={`station-${station.stationId}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50"
                    >
                      <button
                        onClick={() => onRecentStationSelect(station)}
                        className="flex-1 flex items-center gap-2 text-left min-w-0"
                      >
                        <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate block">{station.stationName}</span>
                      </button>
                      <button
                        onClick={() => onRemoveRecentStation(station.stationId)}
                        className="p-1.5 rounded hover:bg-accent flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 최근 검색 - 버스 모드 */}
            {mode === 'bus' && currentRecentRoutes.length > 0 && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">최근 검색</span>
                  </div>
                  <button
                    onClick={onClearRecentRoutes}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    전체 삭제
                  </button>
                </div>
                <div className="space-y-1">
                  {currentRecentRoutes.map((route) => (
                    <div
                      key={`route-${route.busId}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50"
                    >
                      <button
                        onClick={() => onRecentRouteSelect(route)}
                        className="flex-1 flex items-center gap-2 text-left min-w-0"
                      >
                        <Bus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm truncate block">{route.busNo}</span>
                          {route.subInfo && (
                            <span className="text-xs text-muted-foreground truncate block">{route.subInfo}</span>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => onRemoveRecentRoute(route.busId)}
                        className="p-1.5 rounded hover:bg-accent flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Favorites mode content */}
            {mode === 'favorites' && (
              <div className="space-y-4">
                {/* Favorite stations */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">정류소</span>
                    <span className="text-xs text-muted-foreground">({favoriteStations.length})</span>
                  </div>
                  {favoriteStations.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      즐겨찾기한 정류소가 없습니다
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {favoriteStations.map((station) => (
                        <div
                          key={station.id}
                          className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-accent/50"
                        >
                          <button
                            onClick={() => onFavoriteStationSelect?.(station)}
                            className="flex-1 flex items-center gap-2 text-left min-w-0"
                          >
                            <Star className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" />
                            <span className="text-sm truncate">{station.station_name}</span>
                          </button>
                          <button
                            onClick={() => onRemoveFavoriteStation?.(station.station_id)}
                            className="p-1.5 rounded hover:bg-accent flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Favorite routes */}
                <div className="pt-3 border-t border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Bus className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">노선</span>
                    <span className="text-xs text-muted-foreground">({favoriteRoutes.length})</span>
                  </div>
                  {favoriteRoutes.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      즐겨찾기한 노선이 없습니다
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {favoriteRoutes.map((route) => (
                        <div
                          key={route.id}
                          className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-accent/50"
                        >
                          <button
                            onClick={() => onFavoriteRouteSelect?.(route)}
                            className="flex-1 flex items-center gap-2 text-left min-w-0"
                          >
                            <Star className="w-4 h-4 text-amber-500 flex-shrink-0" fill="currentColor" />
                            <span className="text-sm font-medium">{route.bus_no}</span>
                          </button>
                          <button
                            onClick={() => onRemoveFavoriteRoute?.(route.bus_id)}
                            className="p-1.5 rounded hover:bg-accent flex-shrink-0"
                          >
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
