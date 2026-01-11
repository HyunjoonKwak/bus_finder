'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface NearbyStation {
  stationID: string;
  stationName: string;
  x: string;
  y: string;
  distance: number;
  arsID?: string;
}

interface NearbyStationsProps {
  stations: NearbyStation[];
  loading: boolean;
  searchRadius: number;
  hasMapCenter: boolean;
  onStationClick: (station: NearbyStation) => void;
  onRadiusChange: (radius: number) => void;
  onRefresh: () => void;
}

export function NearbyStations({
  stations,
  loading,
  searchRadius,
  hasMapCenter,
  onStationClick,
  onRadiusChange,
  onRefresh,
}: NearbyStationsProps) {
  return (
    <div className="mt-4 border-t border-border pt-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-muted-foreground whitespace-nowrap">반경</span>
        <div className="flex gap-1 flex-1">
          {[300, 500, 1000].map((radius) => (
            <button
              key={radius}
              onClick={() => onRadiusChange(radius)}
              className={cn(
                "flex-1 py-1.5 text-xs rounded-md transition-colors",
                searchRadius === radius
                  ? "bg-primary text-primary-foreground"
                  : "bg-background border border-border hover:bg-accent"
              )}
            >
              {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">주변 정류소</span>
          {loading ? (
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          ) : (
            <span className="text-xs text-muted-foreground">({stations.length})</span>
          )}
        </div>
        {hasMapCenter && (
          <button
            onClick={onRefresh}
            className="text-xs text-primary hover:underline"
          >
            새로고침
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : stations.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">주변에 정류소가 없습니다</p>
          <p className="text-xs text-muted-foreground mt-1">지도를 이동해보세요</p>
        </div>
      ) : (
        <div className="space-y-1">
          {stations.map((station, idx) => (
            <button
              key={station.stationID}
              onClick={() => onStationClick(station)}
              className="w-full p-3 text-left rounded-lg border border-border hover:bg-accent/50 transition-colors bg-white/50 dark:bg-black/20 backdrop-blur-sm"
            >
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white bg-green-500 shadow-sm">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{station.stationName}</p>
                </div>
                <Badge variant="secondary" className="flex-shrink-0 text-xs bg-muted/80">
                  {Math.round(station.distance)}m
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
