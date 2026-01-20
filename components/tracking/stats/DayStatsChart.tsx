'use client';

import { Card } from '@/components/ui/card';
import type { DayStats } from '@/types/stats';

interface DayStatsChartProps {
  byDay: DayStats[];
}

export function DayStatsChart({ byDay }: DayStatsChartProps) {
  if (byDay.length === 0) {
    return null;
  }

  const maxCount = Math.max(...byDay.map((d) => d.count));

  return (
    <Card className="p-4" role="region" aria-labelledby="day-chart-heading">
      <h2 id="day-chart-heading" className="font-semibold text-foreground mb-3">
        요일별 평균 도착 시간
      </h2>
      <div className="space-y-2" role="list" aria-label="요일별 평균 도착 시간 목록">
        {byDay.map((day) => {
          const barWidth = maxCount > 0 ? (day.count / maxCount) * 100 : 0;
          // 시간을 분으로 변환해서 위치 계산 (5:00~24:00 범위)
          const avgMinutes = day.avgTime
            ? parseInt(day.avgTime.split(':')[0]) * 60 + parseInt(day.avgTime.split(':')[1])
            : null;
          const timePosition =
            avgMinutes !== null ? ((avgMinutes - 300) / (1440 - 300)) * 100 : null; // 5:00=300분, 24:00=1440분

          return (
            <div
              key={day.day}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
              role="listitem"
              aria-label={`${day.dayName}요일: ${day.avgTime ? `평균 ${day.avgTime}` : '기록 없음'}, ${day.count}회 기록`}
            >
              <span className="font-medium text-foreground w-8" aria-hidden="true">
                {day.dayName}
              </span>
              <div className="flex-1 mx-4 relative" aria-hidden="true">
                {/* 배경 바 (기록 수 기준) */}
                <div
                  className="bg-primary/20 rounded-full h-2"
                  style={{ width: `${Math.max(barWidth, 5)}%` }}
                />
                {/* 시간 위치 표시 점 */}
                {timePosition !== null && day.count > 0 && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full border-2 border-background shadow-sm"
                    style={{ left: `${Math.max(5, Math.min(95, timePosition))}%` }}
                  />
                )}
              </div>
              <div className="text-right min-w-[80px]" aria-hidden="true">
                {day.avgTime ? (
                  <span className="font-semibold text-primary">{day.avgTime}</span>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
                <span className="text-xs text-muted-foreground ml-2">({day.count}회)</span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground mt-2">● 점은 평균 도착 시간 위치</p>
    </Card>
  );
}
