'use client';

import { Card } from '@/components/ui/card';

export function StatsPageSkeleton() {
  return (
    <div className="px-4 py-4" role="status" aria-label="통계 데이터 로딩 중">
      {/* 헤더 스켈레톤 */}
      <div className="flex items-center mb-4">
        <div className="w-20 h-5 bg-muted animate-pulse rounded" />
      </div>
      <div className="mb-4">
        <div className="w-32 h-6 bg-muted animate-pulse rounded mb-1" />
        <div className="w-24 h-4 bg-muted animate-pulse rounded" />
      </div>

      {/* 기간 선택 스켈레톤 */}
      <div className="flex gap-2 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="w-12 h-8 bg-muted animate-pulse rounded" />
        ))}
      </div>

      {/* 요약 카드 스켈레톤 */}
      <Card className="p-4 mb-4">
        <div className="w-16 h-5 bg-muted animate-pulse rounded mb-3" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="text-center">
              <div className="w-16 h-8 bg-muted animate-pulse rounded mx-auto mb-1" />
              <div className="w-12 h-3 bg-muted animate-pulse rounded mx-auto" />
            </div>
          ))}
        </div>
      </Card>

      {/* 차트 스켈레톤 */}
      <Card className="p-4 mb-4">
        <div className="w-32 h-5 bg-muted animate-pulse rounded mb-3" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-6 h-4 bg-muted animate-pulse rounded" />
              <div
                className="flex-1 h-2 bg-muted animate-pulse rounded"
                style={{ width: `${30 + (i * 7) % 50}%` }}
              />
              <div className="w-16 h-4 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      </Card>

      {/* 시간대별 차트 스켈레톤 */}
      <Card className="p-4">
        <div className="w-32 h-5 bg-muted animate-pulse rounded mb-3" />
        <div className="flex items-end h-32 gap-1">
          {Array.from({ length: 24 }, (_, i) => (
            <div
              key={i}
              className="flex-1 bg-muted animate-pulse rounded-t"
              style={{ height: `${10 + ((i * 13) % 80)}%` }}
            />
          ))}
        </div>
      </Card>
      <span className="sr-only">데이터를 불러오는 중입니다</span>
    </div>
  );
}
