'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { RealtimeArrivalInfo } from '@/lib/odsay/types';
import { formatArrivalTime } from '@/lib/odsay';
import { BUS_TYPE_NAMES, BUS_TYPE_COLORS } from '@/lib/publicdata/bus-arrival';

interface ArrivalInfoProps {
  arrivals: RealtimeArrivalInfo[];
  loading?: boolean;
  trackingTargets?: string[];
  onToggleTracking?: (busId: string, busNo: string) => void;
  onBusClick?: (busId: string, busNo: string) => void;
}

export function ArrivalInfo({
  arrivals,
  loading,
  trackingTargets = [],
  onToggleTracking,
  onBusClick,
}: ArrivalInfoProps) {
  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 animate-pulse">
            <div className="flex items-center justify-between">
              <div className="h-5 w-20 bg-muted rounded" />
              <div className="h-6 w-16 bg-muted rounded" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (arrivals.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <p className="text-muted-foreground">도착 예정 버스가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {arrivals.map((arrival, index) => {
        const isTracking = trackingTargets.includes(arrival.routeID);

        return (
          <Card key={`${arrival.routeID}-${index}`} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {/* 버스 타입 배지 (광역, M버스, 직행좌석 등) */}
                  {arrival.routeType && BUS_TYPE_NAMES[arrival.routeType] && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${BUS_TYPE_COLORS[arrival.routeType] || 'bg-gray-100 text-gray-800'}`}>
                      {BUS_TYPE_NAMES[arrival.routeType]}
                    </span>
                  )}
                  {onBusClick ? (
                    <button
                      onClick={() => onBusClick(arrival.routeID, arrival.routeNm)}
                      className="font-bold text-lg text-primary hover:underline hover:text-primary/80 transition-colors text-left"
                    >
                      {arrival.routeNm}
                      <ChevronRightIcon className="w-4 h-4 inline-block ml-0.5 opacity-50" />
                    </button>
                  ) : (
                    <span className="font-bold text-lg text-primary">
                      {arrival.routeNm}
                    </span>
                  )}
                  {isTracking && (
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
                      추적중
                    </Badge>
                  )}
                </div>
                {arrival.arrival1?.busPosition && (
                  <p className="text-xs text-muted-foreground mt-1">
                    현재 위치: {arrival.arrival1.busPosition}
                  </p>
                )}
                {/* 버스 상세 정보 (차량번호, 저상버스, 좌석, 혼잡도) */}
                {arrival.arrival1 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    {arrival.arrival1.lowPlate && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        저상
                      </span>
                    )}
                    {arrival.arrival1.busPlateNo && (
                      <span className="text-[10px] text-muted-foreground">
                        {arrival.arrival1.busPlateNo}
                      </span>
                    )}
                    {arrival.arrival1.remainSeat !== undefined && arrival.arrival1.remainSeat >= 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        좌석 {arrival.arrival1.remainSeat}석
                      </span>
                    )}
                    {arrival.arrival1.crowded !== undefined && arrival.arrival1.crowded > 0 && (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        arrival.arrival1.crowded === 1 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                        arrival.arrival1.crowded === 2 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                        arrival.arrival1.crowded === 3 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      }`}>
                        {arrival.arrival1.crowded === 1 ? '여유' :
                         arrival.arrival1.crowded === 2 ? '보통' :
                         arrival.arrival1.crowded === 3 ? '혼잡' : '매우혼잡'}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                {onToggleTracking && (
                  <button
                    onClick={() => onToggleTracking(arrival.routeID, arrival.routeNm)}
                    className={`p-2 rounded-full transition-colors ${
                      isTracking
                        ? 'bg-primary/10 text-primary'
                        : 'bg-muted text-muted-foreground hover:text-primary'
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
                            ? 'bg-destructive'
                            : arrival.arrival1.arrivalSec < 300
                            ? 'bg-orange-500'
                            : 'bg-primary'
                        }`}
                      >
                        {formatArrivalTime(arrival.arrival1.arrivalSec)}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">
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
              <div className="mt-2 pt-2 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">다음 버스</span>
                  <span className="text-foreground">
                    {formatArrivalTime(arrival.arrival2.arrivalSec)} (
                    {arrival.arrival2.leftStation}정류장 전)
                  </span>
                </div>
                {/* 다음 버스 상세 정보 */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  {arrival.arrival2.lowPlate && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      저상
                    </span>
                  )}
                  {arrival.arrival2.busPlateNo && (
                    <span className="text-[10px] text-muted-foreground">
                      {arrival.arrival2.busPlateNo}
                    </span>
                  )}
                  {arrival.arrival2.remainSeat !== undefined && arrival.arrival2.remainSeat >= 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      좌석 {arrival.arrival2.remainSeat}석
                    </span>
                  )}
                  {arrival.arrival2.crowded !== undefined && arrival.arrival2.crowded > 0 && (
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      arrival.arrival2.crowded === 1 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                      arrival.arrival2.crowded === 2 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                      arrival.arrival2.crowded === 3 ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                      'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    }`}>
                      {arrival.arrival2.crowded === 1 ? '여유' :
                       arrival.arrival2.crowded === 2 ? '보통' :
                       arrival.arrival2.crowded === 3 ? '혼잡' : '매우혼잡'}
                    </span>
                  )}
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
