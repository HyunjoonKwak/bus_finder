'use client';

import { ChevronUp, X, Star, MapPin, Bus, Clock, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StationInfo, BusLaneInfo, RealtimeArrivalInfo } from '@/lib/odsay/types';
import { getBusTypeStyle } from '@/lib/bus-utils';

interface MobileInfoCardProps {
  type: 'station' | 'bus';
  station?: StationInfo | null;
  bus?: BusLaneInfo | null;
  arrivals?: RealtimeArrivalInfo[];
  loadingArrivals?: boolean;
  // Bus route info
  busStationsCount?: number;
  busPositionsCount?: number;
  loadingBusRoute?: boolean;
  isFavorite?: boolean;
  onExpand: () => void;
  onClose: () => void;
  onToggleFavorite?: () => void;
  onRefresh?: () => void;
  onBusClick?: (arrival: RealtimeArrivalInfo) => void;
}

export function MobileInfoCard({
  type,
  station,
  bus,
  arrivals = [],
  loadingArrivals,
  busStationsCount = 0,
  busPositionsCount = 0,
  loadingBusRoute,
  isFavorite,
  onExpand,
  onClose,
  onToggleFavorite,
  onRefresh,
  onBusClick,
}: MobileInfoCardProps) {
  if (type === 'station' && !station) return null;
  if (type === 'bus' && !bus) return null;

  // Get first 2 arrivals to preview
  const previewArrivals = arrivals.slice(0, 2);

  const formatArrivalTime = (seconds?: number) => {
    if (!seconds) return null;
    if (seconds < 60) return '곧 도착';
    const minutes = Math.floor(seconds / 60);
    return `${minutes}분`;
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-border/30 overflow-hidden">
        {/* Header - tappable to expand */}
        <button
          onClick={onExpand}
          className="w-full p-4 flex items-start justify-between text-left"
        >
          <div className="flex-1 min-w-0">
            {type === 'station' && station && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0" />
                  <h3 className="font-semibold text-base truncate">{station.stationName}</h3>
                </div>
                <p className="text-xs text-muted-foreground ml-6">
                  {station.arsID || station.stationID}
                </p>
              </>
            )}
            {type === 'bus' && bus && (
              <>
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-xs font-bold",
                    getBusTypeStyle(bus.type).bg,
                    getBusTypeStyle(bus.type).text
                  )}>
                    {bus.busNo}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {bus.busStartPoint} → {bus.busEndPoint}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 ml-2">
            {onToggleFavorite && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite();
                }}
                className="p-2 rounded-full hover:bg-accent"
              >
                <Star className={cn("w-5 h-5", isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-2 rounded-full hover:bg-accent"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </button>

        {/* Preview arrivals for station */}
        {type === 'station' && (
          <div className="px-4 pb-4 border-t border-border/50">
            <div className="flex items-center justify-between pt-3 mb-2">
              <span className="text-xs text-muted-foreground">도착 예정</span>
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  className="p-1 rounded hover:bg-accent"
                  disabled={loadingArrivals}
                >
                  <RefreshCw className={cn("w-3.5 h-3.5 text-muted-foreground", loadingArrivals && "animate-spin")} />
                </button>
              )}
            </div>

            {loadingArrivals ? (
              <div className="flex items-center justify-center py-3">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : previewArrivals.length > 0 ? (
              <div className="space-y-2">
                {previewArrivals.map((arrival) => (
                  <div key={arrival.routeID} className="flex items-center justify-between">
                    <button
                      onClick={() => onBusClick?.(arrival)}
                      className="flex items-center gap-2"
                    >
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-xs font-bold",
                        getBusTypeStyle(arrival.routeType).bg,
                        getBusTypeStyle(arrival.routeType).text
                      )}>
                        {arrival.routeNm}
                      </span>
                    </button>
                    <div className="flex items-center gap-3 text-sm">
                      {arrival.arrival1 && (
                        <span className="text-primary font-medium">
                          {formatArrivalTime(arrival.arrival1.arrivalSec)}
                        </span>
                      )}
                      {arrival.arrival2 && (
                        <span className="text-muted-foreground">
                          {formatArrivalTime(arrival.arrival2.arrivalSec)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                도착 정보가 없습니다
              </p>
            )}

            {arrivals.length > 2 && (
              <button
                onClick={onExpand}
                className="w-full mt-3 py-2 flex items-center justify-center gap-1 text-sm text-primary"
              >
                <span>전체 {arrivals.length}개 노선 보기</span>
                <ChevronUp className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Bus route info */}
        {type === 'bus' && bus && (
          <div className="px-4 pb-4 border-t border-border/50">
            <div className="flex items-center justify-between pt-3 mb-2">
              <span className="text-xs text-muted-foreground">노선 정보</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] font-medium",
                getBusTypeStyle(bus.type).bg,
                getBusTypeStyle(bus.type).text
              )}>
                {getBusTypeStyle(bus.type).label}
              </span>
            </div>

            {loadingBusRoute ? (
              <div className="flex items-center justify-center py-3">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground">첫차</p>
                  <p className="text-sm font-medium">{bus.busFirstTime || '--:--'}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground">막차</p>
                  <p className="text-sm font-medium">{bus.busLastTime || '--:--'}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground">배차</p>
                  <p className="text-sm font-medium">{bus.busInterval ? `${bus.busInterval}분` : '--'}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground">정류소</p>
                  <p className="text-sm font-medium">{busStationsCount}개</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground">운행중</p>
                  <p className="text-sm font-medium text-primary">{busPositionsCount}대</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground">노선ID</p>
                  <p className="text-[10px] font-medium truncate">{bus.busID}</p>
                </div>
              </div>
            )}

            <button
              onClick={onExpand}
              className="w-full mt-3 py-2 flex items-center justify-center gap-1 text-sm text-primary"
            >
              <span>상세 정보 보기</span>
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Expand indicator */}
        <div className="flex justify-center pb-2">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>
      </div>
    </div>
  );
}
