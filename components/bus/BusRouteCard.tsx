'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BusLaneInfo } from '@/lib/odsay/types';
import { BUS_TYPE_MAP } from '@/lib/odsay/types';

interface BusRouteCardProps {
  bus: BusLaneInfo;
  onClick?: () => void;
}

export function BusRouteCard({ bus, onClick }: BusRouteCardProps) {
  return (
    <Card
      className={`p-4 ${onClick ? 'cursor-pointer hover:bg-slate-50' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl text-emerald-600">
              {bus.busNo}
            </span>
            <Badge variant="outline" className="text-xs">
              {BUS_TYPE_MAP[bus.type] || '버스'}
            </Badge>
          </div>
          {bus.busStartPoint && bus.busEndPoint && (
            <p className="text-sm text-slate-500 mt-1">
              {bus.busStartPoint} → {bus.busEndPoint}
            </p>
          )}
        </div>
        {onClick && (
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
        )}
      </div>
      {(bus.busFirstTime || bus.busLastTime || bus.busInterval) && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex gap-4 text-xs text-slate-500">
          {bus.busFirstTime && <span>첫차: {bus.busFirstTime}</span>}
          {bus.busLastTime && <span>막차: {bus.busLastTime}</span>}
          {bus.busInterval && <span>배차: {bus.busInterval}분</span>}
        </div>
      )}
    </Card>
  );
}
