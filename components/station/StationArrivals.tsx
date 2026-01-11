'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RealtimeArrivalInfo } from '@/lib/odsay/types';
import { getBusTypeStyle, getCrowdedInfo, formatArrivalTime } from '@/lib/bus-utils';

interface StationArrivalsProps {
  arrivals: RealtimeArrivalInfo[];
  loading: boolean;
  countdown: number;
  trackingBusIds: string[];
  onRefresh: () => void;
  onBusClick: (arrival: RealtimeArrivalInfo) => void;
  onTrackingToggle: (busId: string, busNo: string) => void;
}

import { CircularCountdown } from '@/components/ui/circular-countdown';

export function StationArrivals({
  arrivals,
  loading,
  countdown,
  trackingBusIds,
  onRefresh,
  onBusClick,
  onTrackingToggle,
}: StationArrivalsProps) {
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden bg-white/50 dark:bg-black/50 backdrop-blur-sm">
      <div className="p-3 border-b border-border/50 flex justify-between items-center bg-muted/30">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">실시간 도착 정보</span>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CircularCountdown current={countdown} />
            <span>{countdown}초</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className="h-7 text-xs"
        >
          새로고침
        </Button>
      </div>

      {loading ? (
        <div className="p-8 flex justify-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : arrivals.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground text-sm">
          도착 예정 버스가 없습니다
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {arrivals.map((arrival, idx) => {
            const busStyle = getBusTypeStyle(arrival.routeType);
            const crowded1 = getCrowdedInfo(arrival.arrival1?.crowded);
            const crowded2 = getCrowdedInfo(arrival.arrival2?.crowded);
            const isTracking = trackingBusIds.includes(arrival.routeID);

            return (
              <div
                key={`${arrival.routeID}-${idx}`}
                className="p-3 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => onBusClick(arrival)}
                    className="flex flex-col items-center gap-1 w-14 flex-shrink-0"
                  >
                    <span className={cn(
                      "w-full py-1 text-sm font-bold rounded-lg text-center truncate px-1",
                      busStyle.bg, busStyle.text
                    )}>
                      {arrival.routeNm}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                      {busStyle.label}
                    </span>
                  </button>

                  <button
                    onClick={() => onBusClick(arrival)}
                    className="flex-1 min-w-0 text-left"
                  >
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
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">
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
                        </div>
                      </div>
                    )}

                    {arrival.arrival2 && (
                      <div className="pt-2 border-t border-border/30">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            다음: {formatArrivalTime(arrival.arrival2.arrivalSec)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({arrival.arrival2.leftStation}정거장)
                          </span>
                        </div>
                      </div>
                    )}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrackingToggle(arrival.routeID, arrival.routeNm);
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
  );
}
