'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { StationInfo, NearbyStationInfo } from '@/lib/odsay/types';
import { formatDistance } from '@/lib/odsay';

interface StationListProps {
  stations: (StationInfo | NearbyStationInfo)[];
  onSelect: (station: StationInfo | NearbyStationInfo) => void;
  showDistance?: boolean;
}

export function StationList({
  stations,
  onSelect,
  showDistance = false,
}: StationListProps) {
  if (stations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-slate-500">검색 결과가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {stations.map((station) => (
        <Card
          key={station.stationID}
          className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
          onClick={() => onSelect(station)}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">
                {station.stationName}
              </p>
              {'arsID' in station && station.arsID && (
                <p className="text-xs text-slate-500 mt-1">
                  정류소 번호: {station.arsID}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {showDistance && 'distance' in station && (
                <Badge variant="outline" className="text-xs">
                  {formatDistance(station.distance)}
                </Badge>
              )}
              <svg
                className="w-5 h-5 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
