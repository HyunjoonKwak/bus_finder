'use client';

import { cn } from '@/lib/utils';
import type { BusStationInfo } from '@/lib/odsay/types';

interface BusPosition {
  busStationSeq: number;
  plateNo: string;
  lowPlate?: boolean;
  crowded?: number;
  direction?: number;
}

interface BusStationListProps {
  stations: BusStationInfo[];
  realtimePositions: BusPosition[];
  onStationClick?: (station: BusStationInfo) => void;
  className?: string;
}

export function BusStationList({
  stations,
  realtimePositions,
  onStationClick,
  className,
}: BusStationListProps) {
  if (stations.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground text-sm", className)}>
        정류소 정보가 없습니다.
      </div>
    );
  }

  return (
    <div className={cn("bg-background rounded-lg border border-border overflow-hidden", className)}>
      <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
        <h3 className="font-medium text-sm">정류소 목록</h3>
        <span className="text-xs text-muted-foreground">{stations.length}개</span>
      </div>
      <div className="divide-y divide-border">
        {stations.map((station, idx) => {
          const busAtStation = realtimePositions.filter(p => p.busStationSeq === (station.idx || idx + 1));
          const isFirst = idx === 0;
          const isLast = idx === stations.length - 1;

          return (
            <div
              key={station.stationID}
              className={cn(
                "px-3 py-2.5 transition-colors",
                busAtStation.length > 0 && "bg-blue-50 dark:bg-blue-900/20",
                onStationClick && "cursor-pointer hover:bg-accent/50"
              )}
              onClick={() => onStationClick?.(station)}
            >
              <div className="flex items-center gap-3">
                {/* 순번/버스 아이콘 */}
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
                  {busAtStation.length > 0 ? (
                    <span className="text-xl">🚌</span>
                  ) : (
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                      isFirst && "bg-green-500 text-white",
                      isLast && "bg-red-500 text-white",
                      !isFirst && !isLast && "bg-muted text-muted-foreground"
                    )}>
                      {station.idx || idx + 1}
                    </div>
                  )}
                </div>

                {/* 정류소명 */}
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm truncate",
                    isFirst && "text-green-700 dark:text-green-400 font-semibold",
                    isLast && "text-red-700 dark:text-red-400 font-semibold",
                    !isFirst && !isLast && "font-medium"
                  )}>
                    {isFirst && '🚏 '}{isLast && '🏁 '}
                    {station.stationName}
                  </p>
                  {station.arsID && (
                    <p className="text-xs text-muted-foreground">{station.arsID}</p>
                  )}
                </div>

                {/* 기점/종점 표시 */}
                {(isFirst || isLast) && (
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    isFirst && "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
                    isLast && "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                  )}>
                    {isFirst ? '기점' : '종점'}
                  </span>
                )}
              </div>

              {/* 버스 정보 */}
              {busAtStation.length > 0 && (
                <div className="ml-11 mt-2 flex flex-wrap gap-1.5">
                  {busAtStation.map((bus, busIdx) => {
                    const isOutbound = bus.direction === 0;
                    const isInbound = bus.direction === 1;
                    return (
                      <div
                        key={busIdx}
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium",
                          isOutbound && "bg-blue-100 dark:bg-blue-800/50 text-blue-700 dark:text-blue-200",
                          isInbound && "bg-orange-100 dark:bg-orange-800/50 text-orange-700 dark:text-orange-200",
                          !isOutbound && !isInbound && "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        )}
                      >
                        <span>{bus.plateNo || '차량번호 없음'}</span>
                        {bus.lowPlate && <span>🦽</span>}
                        {isOutbound && <span className="text-blue-600 dark:text-blue-300">▶ 종점방향</span>}
                        {isInbound && <span className="text-orange-600 dark:text-orange-300">◀ 기점방향</span>}
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
  );
}
