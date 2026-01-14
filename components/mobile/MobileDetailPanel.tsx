'use client';

// React hooks not currently used but may be needed for future enhancements
import { Drawer } from 'vaul';
import { ArrowLeft, Star, RefreshCw, Bell, BellOff, MapPin, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StationInfo, BusLaneInfo, BusStationInfo, RealtimeArrivalInfo } from '@/lib/odsay/types';
import { getBusTypeStyle } from '@/lib/bus-utils';
import { CircularCountdown } from '@/components/ui/circular-countdown';

interface MobileDetailPanelProps {
  isOpen: boolean;
  type: 'station' | 'bus';
  station?: StationInfo | null;
  bus?: BusLaneInfo | null;
  arrivals?: RealtimeArrivalInfo[];
  busStations?: BusStationInfo[];
  busPositions?: { stationSeq: number; busStationSeq?: number; sectionOrder?: number; plateNo?: string; lowPlate?: boolean; crowded?: number; direction?: number }[];
  loadingArrivals?: boolean;
  loadingBusRoute?: boolean;
  countdown?: number;
  isFavorite?: boolean;
  trackingBusIds?: string[];
  onClose: () => void;
  onToggleFavorite?: () => void;
  onRefresh?: () => void;
  onBusClick?: (arrival: RealtimeArrivalInfo) => void;
  onTrackingToggle?: (busId: string, busNo: string) => void;
  onStationClick?: (station: BusStationInfo) => void;
}

export function MobileDetailPanel({
  isOpen,
  type,
  station,
  bus,
  arrivals = [],
  busStations = [],
  busPositions = [],
  loadingArrivals,
  loadingBusRoute,
  countdown = 15,
  isFavorite,
  trackingBusIds = [],
  onClose,
  onToggleFavorite,
  onRefresh,
  onBusClick,
  onTrackingToggle,
  onStationClick,
}: MobileDetailPanelProps) {
  const formatArrivalTime = (seconds?: number) => {
    if (!seconds) return null;
    if (seconds < 60) return '곧 도착';
    const minutes = Math.floor(seconds / 60);
    return `${minutes}분`;
  };

  return (
    <Drawer.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
        <Drawer.Content className="fixed flex flex-col bg-background bottom-0 left-0 right-0 max-h-[92vh] rounded-t-2xl z-50 outline-none">
          {/* Handle */}
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted-foreground/20 mt-3" />

          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <button onClick={onClose} className="p-2 -ml-2 rounded-full hover:bg-accent">
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 text-center">
              {type === 'station' && station && (
                <h2 className="font-semibold truncate px-2">{station.stationName}</h2>
              )}
              {type === 'bus' && bus && (
                <div className="flex items-center justify-center gap-2">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-sm font-bold",
                    getBusTypeStyle(bus.type).bg,
                    getBusTypeStyle(bus.type).text
                  )}>
                    {bus.busNo}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1">
              {onRefresh && type === 'station' && (
                <div className="relative">
                  <CircularCountdown duration={15} current={countdown} size={32} />
                  <button
                    onClick={onRefresh}
                    className="absolute inset-0 flex items-center justify-center"
                    disabled={loadingArrivals}
                  >
                    <RefreshCw className={cn("w-3.5 h-3.5", loadingArrivals && "animate-spin")} />
                  </button>
                </div>
              )}
              {onToggleFavorite && (
                <button onClick={onToggleFavorite} className="p-2 rounded-full hover:bg-accent">
                  <Star className={cn("w-5 h-5", isFavorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground")} />
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Station arrivals */}
            {type === 'station' && (
              <div className="p-4">
                {station && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {station.arsID || station.stationID}
                  </p>
                )}

                {loadingArrivals ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : arrivals.length > 0 ? (
                  <div className="space-y-2">
                    {arrivals.map((arrival) => {
                      const isTracking = trackingBusIds.includes(arrival.routeID);
                      return (
                        <div
                          key={arrival.routeID}
                          className="p-3 bg-muted/30 rounded-xl"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <button
                              onClick={() => onBusClick?.(arrival)}
                              className="flex items-center gap-2"
                            >
                              <span className={cn(
                                "px-2 py-1 rounded text-sm font-bold",
                                getBusTypeStyle(arrival.routeType).bg,
                                getBusTypeStyle(arrival.routeType).text
                              )}>
                                {arrival.routeNm}
                              </span>
                            </button>

                            {onTrackingToggle && (
                              <button
                                onClick={() => onTrackingToggle(arrival.routeID, arrival.routeNm)}
                                className={cn(
                                  "p-2 rounded-full transition-colors",
                                  isTracking ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
                                )}
                              >
                                {isTracking ? <Bell className="w-4 h-4 fill-current" /> : <BellOff className="w-4 h-4" />}
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-4 ml-1">
                            {arrival.arrival1 ? (
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-semibold text-primary">
                                  {formatArrivalTime(arrival.arrival1.arrivalSec)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {arrival.arrival1.leftStation}정거장
                                </span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">정보 없음</span>
                            )}

                            {arrival.arrival2 && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <span className="text-sm">
                                  {formatArrivalTime(arrival.arrival2.arrivalSec)}
                                </span>
                                <span className="text-xs">
                                  {arrival.arrival2.leftStation}정거장
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">도착 예정 버스가 없습니다</p>
                  </div>
                )}
              </div>
            )}

            {/* Bus route */}
            {type === 'bus' && (
              <div className="p-4">
                {bus && (
                  <p className="text-sm text-muted-foreground mb-4">
                    {bus.busStartPoint} → {bus.busEndPoint}
                  </p>
                )}

                {/* Bus info summary */}
                {bus && (
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">첫차</p>
                      <p className="text-sm font-medium">{bus.busFirstTime || '--:--'}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">막차</p>
                      <p className="text-sm font-medium">{bus.busLastTime || '--:--'}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2 text-center">
                      <p className="text-[10px] text-muted-foreground">배차</p>
                      <p className="text-sm font-medium">{bus.busInterval ? `${bus.busInterval}분` : '--'}</p>
                    </div>
                  </div>
                )}

                {/* Running buses info */}
                {busPositions.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                    <p className="text-xs text-muted-foreground mb-2">운행중인 버스 ({busPositions.length}대)</p>
                    <div className="flex flex-wrap gap-2">
                      {busPositions.map((pos, idx) => {
                        const isOutbound = pos.direction === 0;
                        const isInbound = pos.direction === 1;
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs",
                              isOutbound && "bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200",
                              isInbound && "bg-orange-100 dark:bg-orange-800/50 text-orange-800 dark:text-orange-200",
                              !isOutbound && !isInbound && "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                            )}
                          >
                            <span>🚌</span>
                            <span className="font-medium">{pos.plateNo || `버스${idx + 1}`}</span>
                            {pos.lowPlate && <span>🦽</span>}
                            {isOutbound && <span className="text-blue-600 dark:text-blue-300">▶종점</span>}
                            {isInbound && <span className="text-orange-600 dark:text-orange-300">◀기점</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {loadingBusRoute ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : busStations.length > 0 ? (
                  <div className="relative">
                    {/* Route line */}
                    <div className="absolute left-4 top-6 bottom-6 w-0.5 bg-primary/30" />

                    <div className="space-y-1">
                      {busStations.map((s, idx) => {
                        const busesAtStation = busPositions.filter(
                          (p) => p.busStationSeq === s.idx || p.stationSeq === s.idx
                        );
                        const isFirst = idx === 0;
                        const isLast = idx === busStations.length - 1;

                        return (
                          <div key={s.stationID || idx}>
                            <button
                              onClick={() => onStationClick?.(s)}
                              className={cn(
                                "w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 text-left relative",
                                busesAtStation.length > 0 && "bg-blue-50 dark:bg-blue-900/20"
                              )}
                            >
                              {/* Station dot or bus icon */}
                              <div className="w-5 flex-shrink-0 flex justify-center z-10">
                                {busesAtStation.length > 0 ? (
                                  <span className="text-base">🚌</span>
                                ) : (
                                  <div className={cn(
                                    "w-3 h-3 rounded-full border-2",
                                    isFirst ? "bg-green-500 border-green-500" :
                                    isLast ? "bg-red-500 border-red-500" :
                                    "bg-background border-primary"
                                  )} />
                                )}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className={cn(
                                  "text-sm truncate",
                                  isFirst && "text-green-600 dark:text-green-400 font-semibold",
                                  isLast && "text-red-600 dark:text-red-400 font-semibold"
                                )}>
                                  {isFirst && '🚏 '}{isLast && '🏁 '}
                                  {s.stationName}
                                </p>
                                {s.arsID && (
                                  <p className="text-xs text-muted-foreground">{s.arsID}</p>
                                )}
                              </div>

                              <span className="text-xs text-muted-foreground flex-shrink-0">
                                {s.idx || idx + 1}
                              </span>
                            </button>

                            {/* Bus info at station */}
                            {busesAtStation.length > 0 && (
                              <div className="ml-8 mb-2 flex flex-wrap gap-1.5">
                                {busesAtStation.map((bus, busIdx) => {
                                  const isOutbound = bus.direction === 0;
                                  const isInbound = bus.direction === 1;
                                  return (
                                    <div
                                      key={busIdx}
                                      className={cn(
                                        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs",
                                        isOutbound && "bg-blue-100 dark:bg-blue-800/50 text-blue-800 dark:text-blue-200",
                                        isInbound && "bg-orange-100 dark:bg-orange-800/50 text-orange-800 dark:text-orange-200",
                                        !isOutbound && !isInbound && "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                                      )}
                                    >
                                      <span className="font-medium">{bus.plateNo || '운행중'}</span>
                                      {bus.lowPlate && <span>🦽</span>}
                                      {isOutbound && <span>▶종점</span>}
                                      {isInbound && <span>◀기점</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <MapPin className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">노선 정보를 불러오는 중...</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
