'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import type { HourStats } from '@/types/stats';

interface HourStatsChartProps {
  byHour: HourStats[];
}

export function HourStatsChart({ byHour }: HourStatsChartProps) {
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);

  if (byHour.length === 0) {
    return null;
  }

  const maxCount = Math.max(...byHour.map((h) => h.count));
  const peakHour = byHour.reduce((max, h) => (h.count > max.count ? h : max), byHour[0]);

  return (
    <Card className="p-4" role="region" aria-labelledby="hour-chart-heading">
      <h2 id="hour-chart-heading" className="font-semibold text-foreground mb-3">
        시간대별 도착 분포
      </h2>
      <div
        className="flex items-end h-32 gap-0.5 sm:gap-1 relative"
        role="img"
        aria-label="시간대별 도착 분포 막대 그래프"
      >
        {byHour.map((hour) => {
          const height = maxCount > 0 ? (hour.count / maxCount) * 100 : 0;
          const isHovered = hoveredHour === hour.hour;

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
              aria-label={`${hour.hour}시: ${hour.count}회 도착`}
            >
              {/* 툴팁 */}
              {isHovered && hour.count > 0 && (
                <div
                  className="absolute bottom-full mb-2 px-2 py-1 bg-foreground text-background text-xs rounded shadow-lg whitespace-nowrap z-10 pointer-events-none"
                  role="tooltip"
                >
                  {hour.hour}시: {hour.count}회
                </div>
              )}
              <div
                className={`w-full rounded-t transition-all duration-150 ${
                  hour.count > 0
                    ? isHovered
                      ? 'bg-primary/80'
                      : 'bg-primary'
                    : 'bg-muted'
                }`}
                style={{ height: `${Math.max(height, 2)}%` }}
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
      {/* 스크린 리더용 요약 */}
      <div className="sr-only">
        가장 많은 도착: {peakHour.hour}시에 {peakHour.count}회
      </div>
    </Card>
  );
}
