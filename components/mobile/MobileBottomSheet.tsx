'use client';

import { useState, useEffect } from 'react';
import { Search, MapPin, Bus, Navigation, Bell, ChevronUp, ChevronDown, RefreshCw, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { NearbyStation } from '@/components/station/NearbyStations';

type SearchMode = 'station' | 'bus' | 'search' | 'tracking';
type SheetState = 'collapsed' | 'half' | 'expanded';

interface SearchHistoryItem {
  type: 'station' | 'bus';
  id: string;
  name: string;
  subInfo?: string;
  x?: string;
  y?: string;
  arsID?: string;
  busType?: number;
  timestamp: number;
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
  // History
  searchHistory: SearchHistoryItem[];
  onHistorySelect: (item: SearchHistoryItem) => void;
  onRemoveHistoryItem: (type: string, id: string) => void;
  onClearHistory: () => void;
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
  searchHistory,
  onHistorySelect,
  onRemoveHistoryItem,
  onClearHistory,
}: MobileBottomSheetProps) {
  const [sheetState, setSheetState] = useState<SheetState>('collapsed');

  const getPlaceholder = () => {
    switch (mode) {
      case 'station': return '정류소 검색';
      case 'bus': return '버스 번호 검색';
      case 'search': return '목적지 검색';
      case 'tracking': return '추적 중인 버스';
    }
  };

  const toggleSheet = () => {
    setSheetState(prev => prev === 'collapsed' ? 'half' : 'collapsed');
  };

  const filteredHistory = searchHistory.filter(h =>
    mode === 'station' ? h.type === 'station' :
    mode === 'bus' ? h.type === 'bus' : true
  ).slice(0, 5);

  // Reset to collapsed when mode changes
  useEffect(() => {
    if (mode === 'search' || mode === 'tracking') {
      setSheetState('collapsed');
    }
  }, [mode]);

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
            { id: 'search', label: '길찾기', icon: Navigation },
            { id: 'tracking', label: '추적', icon: Bell },
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

          {(mode === 'station' || mode === 'bus') && (
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
          )}
        </div>

        {/* Expanded content */}
        {sheetState === 'half' && (mode === 'station' || mode === 'bus') && (
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
            {filteredHistory.length > 0 && (
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium text-sm">최근 검색</span>
                  </div>
                  <button
                    onClick={onClearHistory}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    전체 삭제
                  </button>
                </div>
                <div className="space-y-1">
                  {filteredHistory.map((item) => (
                    <div
                      key={`${item.type}-${item.id}`}
                      className="flex items-center gap-2 p-2 rounded-lg hover:bg-accent/50"
                    >
                      <button
                        onClick={() => onHistorySelect(item)}
                        className="flex-1 flex items-center gap-2 text-left min-w-0"
                      >
                        {item.type === 'station' ? (
                          <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <Bus className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="text-sm truncate block">{item.name}</span>
                          {item.subInfo && (
                            <span className="text-xs text-muted-foreground truncate block">{item.subInfo}</span>
                          )}
                        </div>
                      </button>
                      <button
                        onClick={() => onRemoveHistoryItem(item.type, item.id)}
                        className="p-1.5 rounded hover:bg-accent flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
