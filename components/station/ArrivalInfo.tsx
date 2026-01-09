'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { RealtimeArrivalInfo } from '@/lib/odsay/types';
import { formatArrivalTime } from '@/lib/odsay';

interface ArrivalInfoProps {
  arrivals: RealtimeArrivalInfo[];
  loading?: boolean;
}

export function ArrivalInfo({ arrivals, loading }: ArrivalInfoProps) {
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
      {arrivals.map((arrival) => (
        <Card key={arrival.routeID} className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-emerald-600">
                  {arrival.routeNm}
                </span>
              </div>
              {arrival.arrival1?.busPosition && (
                <p className="text-xs text-slate-500 mt-1">
                  현재 위치: {arrival.arrival1.busPosition}
                </p>
              )}
            </div>
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
      ))}
    </div>
  );
}
