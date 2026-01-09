'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { RealtimeArrivalInfo } from '@/lib/odsay/types';
import { formatArrivalTime } from '@/lib/odsay';

interface ArrivalInfoProps {
  arrivals: RealtimeArrivalInfo[];
  loading?: boolean;
  trackingTargets?: string[];
  onToggleTracking?: (busId: string, busNo: string) => void;
}

export function ArrivalInfo({
  arrivals,
  loading,
  trackingTargets = [],
  onToggleTracking,
}: ArrivalInfoProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="h-5 w-20 bg-slate-200 rounded" />
              <div className="h-6 w-16 bg-slate-200 rounded" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (arrivals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-slate-500">도착 예정 버스가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {arrivals.map((arrival) => {
        const isTracking = trackingTargets.includes(arrival.routeID);

        return (
          <Card key={arrival.routeID} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-emerald-600">
                    {arrival.routeNm}
                  </span>
                  {isTracking && (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200">
                      추적중
                    </Badge>
                  )}
                </div>
                {arrival.arrival1?.busPosition && (
                  <p className="text-xs text-slate-500 mt-1">
                    현재 위치: {arrival.arrival1.busPosition}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {onToggleTracking && (
                  <button
                    onClick={() => onToggleTracking(arrival.routeID, arrival.routeNm)}
                    className={`p-2 rounded-full transition-colors ${
                      isTracking
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-slate-100 text-slate-400 hover:text-blue-600'
                    }`}
                    title={isTracking ? '추적 해제' : '도착 시간 추적'}
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </button>
                )}
                <div className="text-right">
                  {arrival.arrival1 ? (
                    <>
                      <Badge
                        className={`text-sm ${
                          arrival.arrival1.arrivalSec < 180
                            ? 'bg-red-500'
                            : arrival.arrival1.arrivalSec < 300
                            ? 'bg-orange-500'
                            : 'bg-emerald-500'
                        }`}
                      >
                        {formatArrivalTime(arrival.arrival1.arrivalSec)}
                      </Badge>
                      <p className="text-xs text-slate-500 mt-1">
                        {arrival.arrival1.leftStation}정류장 전
                      </p>
                    </>
                  ) : (
                    <Badge variant="outline">운행정보 없음</Badge>
                  )}
                </div>
              </div>
            </div>
            {arrival.arrival2 && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">다음 버스</span>
                  <span className="text-slate-600">
                    {formatArrivalTime(arrival.arrival2.arrivalSec)} (
                    {arrival.arrival2.leftStation}정류장 전)
                  </span>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
