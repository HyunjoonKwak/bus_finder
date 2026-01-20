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

  // 배차간격이 있는 요일만 필터링하여 최대값 계산
  const daysWithInterval = byDay.filter((d) => d.avgInterval !== null);
  const maxInterval = daysWithInterval.length > 0
    ? Math.max(...daysWithInterval.map((d) => d.avgInterval!))
    : 30;

  return (
    <Card className="p-4" role="region" aria-labelledby="day-chart-heading">
      <h2 id="day-chart-heading" className="font-semibold text-foreground mb-3">
        요일별 배차 현황
      </h2>
      <div className="space-y-2" role="list" aria-label="요일별 배차간격 목록">
        {byDay.map((day) => {
          // 배차간격 바 너비 계산 (낮을수록 좋음 → 역으로 표시)
          const barWidth = day.avgInterval !== null
            ? Math.max(10, 100 - (day.avgInterval / maxInterval) * 70)
            : 0;

          return (
            <div
              key={day.day}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
              role="listitem"
              aria-label={`${day.dayName}요일: ${day.avgInterval !== null ? `평균 ${day.avgInterval}분 간격` : '데이터 부족'}, ${day.count}회 기록`}
            >
              <span className="font-medium text-foreground w-8" aria-hidden="true">
                {day.dayName}
              </span>
              <div className="flex-1 mx-4 relative" aria-hidden="true">
                {/* 배차간격 바 (짧을수록 긴 바 = 자주 옴) */}
                {day.avgInterval !== null && day.count > 0 ? (
                  <div
                    className="bg-primary/60 rounded-full h-2 transition-all"
                    style={{ width: `${barWidth}%` }}
                  />
                ) : (
                  <div className="bg-muted/30 rounded-full h-2 w-[10%]" />
                )}
              </div>
              <div className="text-right min-w-[100px]" aria-hidden="true">
                {day.avgInterval !== null ? (
                  <>
                    <span className="font-semibold text-primary">{day.avgInterval}분</span>
                    <span className="text-xs text-muted-foreground ml-1">간격</span>
                  </>
                ) : (
                  <span className="text-muted-foreground text-sm">-</span>
                )}
                <span className="text-xs text-muted-foreground ml-2">({day.count}회)</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          ※ 배차간격이 짧을수록 버스가 자주 옵니다
        </p>
        {daysWithInterval.length > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            가장 자주: <span className="text-primary font-medium">
              {daysWithInterval.reduce((min, d) =>
                d.avgInterval! < min.avgInterval! ? d : min
              ).dayName}요일
            </span>
            {' '}({Math.min(...daysWithInterval.map(d => d.avgInterval!))}분 간격)
          </p>
        )}
      </div>
    </Card>
  );
}
