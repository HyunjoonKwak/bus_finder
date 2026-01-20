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

  // 비교를 위한 최대값 계산
  const maxInterval = Math.max(
    weekdayStats?.avgInterval || 0,
    weekendStats?.avgInterval || 0
  );
  const maxDailyCount = Math.max(
    weekdayStats?.dailyAvgCount || 0,
    weekendStats?.dailyAvgCount || 0
  );

  const renderStats = (
    stats: WeekdayWeekendStats | null,
    label: string,
    colorClass: string,
    bgClass: string
  ) => (
    <div className={`${bgClass} rounded-lg p-3`}>
      <p className={`text-sm font-medium ${colorClass} mb-2`}>{label}</p>
      {stats ? (
        <>
          {/* 평균 배차간격 */}
          <div className="mb-3">
            <p className="text-2xl font-bold text-foreground">
              {stats.avgInterval !== null ? `${stats.avgInterval}분` : '-'}
            </p>
            <p className="text-xs text-muted-foreground">평균 배차간격</p>
            {stats.avgInterval !== null && maxInterval > 0 && (
              <div className="mt-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colorClass.replace('text-', 'bg-').replace('-600', '-500').replace('-400', '-400')} rounded-full transition-all`}
                  style={{ width: `${Math.max(10, 100 - (stats.avgInterval / maxInterval) * 70)}%` }}
                />
              </div>
            )}
          </div>

          {/* 일평균 도착 횟수 */}
          <div className="mb-3 pb-3 border-b border-border/50">
            <p className="text-lg font-semibold text-foreground">
              {stats.dailyAvgCount !== null ? `${stats.dailyAvgCount}회` : '-'}
            </p>
            <p className="text-xs text-muted-foreground">일평균 도착</p>
            {stats.dailyAvgCount !== null && maxDailyCount > 0 && (
              <div className="mt-1 h-1.5 bg-muted/30 rounded-full overflow-hidden">
                <div
                  className={`h-full ${colorClass.replace('text-', 'bg-').replace('-600', '-500').replace('-400', '-400')} rounded-full transition-all`}
                  style={{ width: `${(stats.dailyAvgCount / maxDailyCount) * 100}%` }}
                />
              </div>
            )}
          </div>

          {/* 운행 시간대 */}
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">운행 시간대</p>
            <p>
              {stats.firstArrival} ~ {stats.lastArrival}
            </p>
            <p className="mt-1">{stats.count}회 기록</p>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">기록 없음</p>
      )}
    </div>
  );

  return (
    <Card className="p-4" role="region" aria-labelledby="weekday-weekend-heading">
      <h2 id="weekday-weekend-heading" className="font-semibold text-foreground mb-3">
        주중 vs 주말
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {renderStats(
          weekdayStats,
          '주중 (월~금)',
          'text-blue-600 dark:text-blue-400',
          'bg-blue-500/10'
        )}
        {renderStats(
          weekendStats,
          '주말 (토~일)',
          'text-orange-600 dark:text-orange-400',
          'bg-orange-500/10'
        )}
      </div>

      {/* 비교 요약 */}
      {weekdayStats?.avgInterval && weekendStats?.avgInterval && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {weekdayStats.avgInterval < weekendStats.avgInterval ? (
              <>
                주중이 주말보다{' '}
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  {weekendStats.avgInterval - weekdayStats.avgInterval}분
                </span>{' '}
                더 자주 옵니다
              </>
            ) : weekdayStats.avgInterval > weekendStats.avgInterval ? (
              <>
                주말이 주중보다{' '}
                <span className="text-orange-600 dark:text-orange-400 font-medium">
                  {weekdayStats.avgInterval - weekendStats.avgInterval}분
                </span>{' '}
                더 자주 옵니다
              </>
            ) : (
              '주중과 주말의 배차간격이 동일합니다'
            )}
          </p>
        </div>
      )}
    </Card>
  );
}
