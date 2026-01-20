'use client';

import { Card } from '@/components/ui/card';

interface SummaryCardProps {
  totalCount: number;
  avgInterval: number | null;
  firstArrival: string | null;
  lastArrival: string | null;
  stdDeviation: number | null;
}

export function SummaryCard({
  totalCount,
  avgInterval,
  firstArrival,
  lastArrival,
  stdDeviation,
}: SummaryCardProps) {
  return (
    <Card className="p-4" role="region" aria-labelledby="summary-heading">
      <h2 id="summary-heading" className="font-semibold text-foreground mb-3">
        요약
      </h2>
      <div className="grid grid-cols-2 gap-4 text-center" role="list">
        <div role="listitem" aria-label={`총 기록 ${totalCount}회`}>
          <p className="text-2xl font-bold text-primary" aria-hidden="true">
            {totalCount}
          </p>
          <p className="text-xs text-muted-foreground">총 기록</p>
        </div>
        <div
          role="listitem"
          aria-label={`평균 배차간격 ${avgInterval ? `${avgInterval}분` : '데이터 없음'}`}
        >
          <p
            className="text-2xl font-bold text-green-600 dark:text-green-400"
            aria-hidden="true"
          >
            {avgInterval ? `${avgInterval}분` : '-'}
          </p>
          <p className="text-xs text-muted-foreground">평균 배차간격</p>
        </div>
        <div
          role="listitem"
          aria-label={`가장 이른 도착 ${firstArrival || '데이터 없음'}`}
        >
          <p
            className="text-2xl font-bold text-blue-600 dark:text-blue-400"
            aria-hidden="true"
          >
            {firstArrival || '-'}
          </p>
          <p className="text-xs text-muted-foreground">가장 이른 도착</p>
        </div>
        <div
          role="listitem"
          aria-label={`가장 늦은 도착 ${lastArrival || '데이터 없음'}`}
        >
          <p
            className="text-2xl font-bold text-orange-600 dark:text-orange-400"
            aria-hidden="true"
          >
            {lastArrival || '-'}
          </p>
          <p className="text-xs text-muted-foreground">가장 늦은 도착</p>
        </div>
      </div>

      {stdDeviation !== null && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">도착 시간 편차</span>
            <span className="font-semibold text-foreground">±{stdDeviation}분</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {stdDeviation <= 10
              ? '매우 일정한 패턴'
              : stdDeviation <= 20
                ? '비교적 일정한 패턴'
                : '불규칙한 패턴'}
          </p>
        </div>
      )}
    </Card>
  );
}
