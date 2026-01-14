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
  busPositions?: { stationSeq: number; busStationSeq?: number; sectionOrder?: number; plateNo?: string; lowPlate?: boolean; crowded?: number }[];
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
                        const busAtStation = busPositions.find(
                          (p) => p.busStationSeq === s.idx || p.sectionOrder === idx + 1
                        );

                        return (
                          <button
                            key={s.stationID || idx}
                            onClick={() => onStationClick?.(s)}
                            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 text-left relative"
                          >
                            {/* Station dot */}
                            <div className={cn(
                              "w-3 h-3 rounded-full border-2 z-10",
                              idx === 0 || idx === busStations.length - 1
                                ? "bg-primary border-primary"
                                : "bg-background border-primary"
                            )} />

                            {/* Bus indicator */}
                            {busAtStation && (
                              <div className="absolute left-2 -translate-x-1/2 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center z-20">
                                <span className="text-white text-xs">🚌</span>
                              </div>
                            )}

                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "text-sm truncate",
                                (idx === 0 || idx === busStations.length - 1) && "font-semibold"
                              )}>
                                {s.stationName}
                              </p>
                            </div>

                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {idx + 1}
                            </span>
                          </button>
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
