'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import type { HourStats } from '@/types/stats';

interface HourStatsChartProps {
  byHour: HourStats[];
}

export function HourStatsChart({ byHour }: HourStatsChartProps) {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  // 데이터 분석
  const analysis = useMemo(() => {
    if (byHour.length === 0) return null;

    const totalCount = byHour.reduce((sum, h) => sum + h.count, 0);
    const maxCount = Math.max(...byHour.map((h) => h.count));
    const hoursWithData = byHour.filter((h) => h.count > 0);

    // 피크 시간대 찾기 (상위 3개)
    const peakHours = [...byHour]
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .filter((h) => h.count > 0);

    // 활동 시간대 범위 (첫 도착 ~ 마지막 도착)
    let firstHour: number | null = null;
    let lastHour: number | null = null;
    for (let i = 0; i < 24; i++) {
      if (byHour[i].count > 0) {
        if (firstHour === null) firstHour = i;
        lastHour = i;
      }
    }

    return {
      totalCount,
      maxCount,
      hoursWithData: hoursWithData.length,
      peakHours,
      firstHour,
      lastHour,
    };
  }, [byHour]);

  if (byHour.length === 0) {
    return null;
  }

  // 데이터가 전혀 없는 경우
  if (!analysis || analysis.totalCount === 0) {
    return (
      <Card className="p-4" role="region" aria-labelledby="hour-chart-heading">
        <h2 id="hour-chart-heading" className="font-semibold text-foreground mb-3">
          시간대별 도착 분포
        </h2>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <svg
            className="w-12 h-12 text-muted-foreground/40 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-sm text-muted-foreground">
            시간대별 데이터가 아직 충분하지 않습니다
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            더 많은 도착 기록이 쌓이면 분포를 확인할 수 있습니다
          </p>
        </div>
      </Card>
    );
  }

  const { maxCount, peakHours, firstHour, lastHour } = analysis;

  return (
    <Card className="p-4" role="region" aria-labelledby="hour-chart-heading">
      <h2 id="hour-chart-heading" className="font-semibold text-foreground mb-3">
        시간대별 도착 분포
      </h2>

      {/* 막대 그래프 */}
      <div
        className="flex items-end h-32 gap-0.5 sm:gap-1 relative"
        role="img"
        aria-label="시간대별 도착 분포 막대 그래프"
      >
        {byHour.map((hour) => {
          const height = maxCount > 0 ? (hour.count / maxCount) * 100 : 0;
          const isHovered = hoveredHour === hour.hour;
          const isPeak = peakHours.some((p) => p.hour === hour.hour);

          return (
            <button
              key={hour.hour}
              type="button"
              className="flex-1 flex flex-col items-center relative min-w-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
              onMouseEnter={() => setHoveredHour(hour.hour)}
              onMouseLeave={() => setHoveredHour(null)}
              onFocus={() => setHoveredHour(hour.hour)}
              onBlur={() => setHoveredHour(null)}
              onTouchStart={() => setHoveredHour(hour.hour)}
              onTouchEnd={() => setTimeout(() => setHoveredHour(null), 1500)}
              aria-label={`${hour.hour}시: ${hour.count}회 도착${isPeak ? ' (피크)' : ''}`}
            >
              {/* 툴팁 */}
              {isHovered && (
                <div
                  className="absolute bottom-full mb-2 px-2 py-1 bg-foreground text-background text-xs rounded shadow-lg whitespace-nowrap z-10 pointer-events-none"
                  role="tooltip"
                >
                  {hour.hour}시: {hour.count}회
                  {isPeak && ' ⭐'}
                </div>
              )}
              <div
                className={`w-full rounded-t transition-all duration-150 ${
                  hour.count > 0
                    ? isPeak
                      ? isHovered
                        ? 'bg-orange-400'
                        : 'bg-orange-500'
                      : isHovered
                        ? 'bg-primary/80'
                        : 'bg-primary'
                    : 'bg-muted/50'
                }`}
                style={{ height: `${Math.max(height, 3)}%` }}
                aria-hidden="true"
              />
              {hour.hour % 3 === 0 && (
                <span
                  className="text-[10px] sm:text-xs text-muted-foreground mt-1"
                  aria-hidden="true"
                >
                  {hour.hour}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 요약 정보 */}
      <div className="mt-3 pt-3 border-t border-border space-y-1">
        {/* 피크 시간대 */}
        {peakHours.length > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-orange-600 dark:text-orange-400">피크 시간:</span>{' '}
            {peakHours.map((h, i) => (
              <span key={h.hour}>
                {i > 0 && ', '}
                {h.hour}시
                <span className="text-muted-foreground/70">({h.count}회)</span>
              </span>
            ))}
          </p>
        )}

        {/* 활동 시간대 */}
        {firstHour !== null && lastHour !== null && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">주 활동 시간:</span>{' '}
            {firstHour}시 ~ {lastHour}시
          </p>
        )}
      </div>

      {/* 스크린 리더용 요약 */}
      <div className="sr-only">
        {peakHours.length > 0 && (
          <>가장 많은 도착: {peakHours[0].hour}시에 {peakHours[0].count}회</>
        )}
      </div>
    </Card>
  );
}
