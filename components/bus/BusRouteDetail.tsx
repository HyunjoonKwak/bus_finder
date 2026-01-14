'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BusLaneInfo, BusStationInfo } from '@/lib/odsay/types';
import { getBusTypeStyle } from '@/lib/bus-utils';

interface BusPosition {
  busStationSeq: number;
  plateNo: string;
  lowPlate?: boolean;
  crowded?: number;
  direction?: number;
}

interface BusRouteDetailProps {
  bus: BusLaneInfo;
  stations: BusStationInfo[];
  realtimePositions: BusPosition[];
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClose: () => void;
}

export function BusRouteDetail({
  bus,
  stations,
  realtimePositions,
  isFavorite,
  onToggleFavorite,
  onClose,
}: BusRouteDetailProps) {
  const busStyle = getBusTypeStyle(bus.type);
  
  // Type-based gradient colors (from original page.tsx)
  const gradientColors: Record<number, string> = {
    // Seoul
    1: 'from-green-500 to-green-600',
    3: 'from-emerald-500 to-emerald-600',
    4: 'from-red-500 to-red-600',
    5: 'from-sky-500 to-sky-600',
    6: 'from-blue-500 to-blue-600',
    // Gyeonggi
    11: 'from-red-500 to-red-600',
    12: 'from-green-600 to-green-700',
    13: 'from-green-500 to-green-600',
    14: 'from-red-600 to-red-700',
    15: 'from-purple-500 to-purple-600',
    16: 'from-blue-600 to-blue-700',
    // Rural
    21: 'from-red-500 to-red-600',
    22: 'from-green-600 to-green-700',
    23: 'from-green-500 to-green-600',
    // Village
    30: 'from-emerald-500 to-emerald-600',
    // Intercity
    41: 'from-purple-600 to-purple-700',
    42: 'from-purple-500 to-purple-600',
    43: 'from-purple-500 to-purple-600',
    // Airport
    51: 'from-sky-600 to-sky-700',
    52: 'from-sky-500 to-sky-600',
    53: 'from-sky-500 to-sky-600',
  };
  const gradient = gradientColors[bus.type] || 'from-blue-500 to-blue-600';

  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-gradient-to-br text-white p-4 shadow-lg", gradient)}>
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl font-bold whitespace-nowrap">{bus.busNo}</span>
            <Badge className="bg-white/20 text-white border-white/30 hover:bg-white/30 text-xs">
              {busStyle.label}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleFavorite}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              title={isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            >
              {isFavorite ? (
                <svg className="w-5 h-5 text-amber-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Start -> End */}
        {bus.busStartPoint && bus.busEndPoint && (
          <div className="bg-white/10 backdrop-blur rounded-lg p-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center">
                <div className="w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
                <div className="w-0.5 h-4 bg-white/40" />
                <div className="w-3 h-3 bg-red-400 rounded-full border-2 border-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{bus.busStartPoint}</p>
                <p className="text-xs text-white/60 my-1">↓</p>
                <p className="text-sm font-medium truncate">{bus.busEndPoint}</p>
              </div>
            </div>
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-3 gap-2">
          <InfoBox label="첫차" value={bus.busFirstTime || '--:--'} />
          <InfoBox label="막차" value={bus.busLastTime || '--:--'} />
          <InfoBox label="배차" value={bus.busInterval ? `${bus.busInterval}분` : '--'} />
          <InfoBox label="정류소" value={`${stations.length}개`} />
          <InfoBox label="운행중" value={`${realtimePositions.length}대`} />
          <InfoBox label="노선ID" value={bus.busID} valueClass="text-[11px] font-medium truncate" />
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value, valueClass = "text-sm font-semibold" }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-lg p-2">
      <p className="text-[10px] text-white/60 mb-0.5">{label}</p>
      <p className={valueClass}>{value}</p>
    </div>
  );
}
