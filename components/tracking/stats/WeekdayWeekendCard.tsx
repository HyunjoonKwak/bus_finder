'use client';

import { Card } from '@/components/ui/card';
import type { WeekdayWeekendStats } from '@/types/stats';

interface WeekdayWeekendCardProps {
  weekdayStats: WeekdayWeekendStats | null;
  weekendStats: WeekdayWeekendStats | null;
}

export function WeekdayWeekendCard({ weekdayStats, weekendStats }: WeekdayWeekendCardProps) {
  if (!weekdayStats && !weekendStats) {
    return null;
  }

  return (
    <Card className="p-4" role="region" aria-labelledby="weekday-weekend-heading">
      <h2 id="weekday-weekend-heading" className="font-semibold text-foreground mb-3">
        주중 vs 주말
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {/* 주중 */}
        <div className="bg-blue-500/10 rounded-lg p-3">
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
            주중 (월~금)
          </p>
          {weekdayStats ? (
            <>
              <p className="text-lg font-bold text-foreground">{weekdayStats.avgTime}</p>
              <p className="text-xs text-muted-foreground">평균 도착</p>
              <div className="mt-2 text-xs text-muted-foreground">
                <p>
                  {weekdayStats.firstArrival} ~ {weekdayStats.lastArrival}
                </p>
                <p>{weekdayStats.count}회 기록</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">기록 없음</p>
          )}
        </div>
        {/* 주말 */}
        <div className="bg-orange-500/10 rounded-lg p-3">
          <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mb-2">
            주말 (토~일)
          </p>
          {weekendStats ? (
            <>
              <p className="text-lg font-bold text-foreground">{weekendStats.avgTime}</p>
              <p className="text-xs text-muted-foreground">평균 도착</p>
              <div className="mt-2 text-xs text-muted-foreground">
                <p>
                  {weekendStats.firstArrival} ~ {weekendStats.lastArrival}
                </p>
                <p>{weekendStats.count}회 기록</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">기록 없음</p>
          )}
        </div>
      </div>
    </Card>
  );
}
