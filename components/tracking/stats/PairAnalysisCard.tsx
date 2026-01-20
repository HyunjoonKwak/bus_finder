'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { StationPair, PairAnalysis } from '@/types/stats';

interface PairAnalysisCardProps {
  pair: StationPair;
  days: number;
  onDelete?: (pairId: string) => void;
}

export function PairAnalysisCard({ pair, days, onDelete }: PairAnalysisCardProps) {
  const [analysis, setAnalysis] = useState<PairAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchAnalysis = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(
        `/api/tracking/pairs/analysis?pairId=${pair.id}&days=${days}`
      );

      if (!response.ok) {
        throw new Error('분석 데이터 조회 실패');
      }

      const data = await response.json();
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류 발생');
    } finally {
      setLoading(false);
    }
  }, [pair.id, days]);

  useEffect(() => {
    fetchAnalysis();
  }, [fetchAnalysis]);

  const handleDelete = async () => {
    if (!confirm(`"${pair.stationA.name} → ${pair.stationB.name}" 페어를 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/tracking/pairs?id=${pair.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        onDelete?.(pair.id);
      }
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  if (loading) {
    return (
      <Card className="p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-muted rounded" />
          <div className="h-5 w-40 bg-muted rounded" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-16 bg-muted rounded" />
          <div className="h-16 bg-muted rounded" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-4 bg-destructive/10 border-destructive/30">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={fetchAnalysis}>
          다시 시도
        </Button>
      </Card>
    );
  }

  if (!analysis) return null;

  return (
    <Card className="p-4" role="region" aria-label="페어 정류장 분석">
      {/* 헤더 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔗</span>
          <div>
            <p className="font-semibold text-foreground">
              {pair.name || `${pair.stationA.name} → ${pair.stationB.name}`}
            </p>
            {pair.name && (
              <p className="text-xs text-muted-foreground">
                {pair.stationA.name} → {pair.stationB.name}
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          aria-label="페어 삭제"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Button>
      </div>

      {/* 소요시간 통계 */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-primary/10 rounded-lg p-3">
          <p className="text-2xl font-bold text-primary">
            {analysis.avgTravelTime !== null ? `${analysis.avgTravelTime}분` : '-'}
          </p>
          <p className="text-xs text-muted-foreground">평균 소요시간</p>
          {analysis.minTravelTime !== null && analysis.maxTravelTime !== null && (
            <p className="text-xs text-muted-foreground mt-1">
              ({analysis.minTravelTime}분 ~ {analysis.maxTravelTime}분)
            </p>
          )}
        </div>

        <div className={`rounded-lg p-3 ${
          analysis.matchRate >= 80
            ? 'bg-green-500/10'
            : analysis.matchRate >= 50
              ? 'bg-yellow-500/10'
              : 'bg-red-500/10'
        }`}>
          <p className={`text-2xl font-bold ${
            analysis.matchRate >= 80
              ? 'text-green-600 dark:text-green-400'
              : analysis.matchRate >= 50
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-600 dark:text-red-400'
          }`}>
            {analysis.matchRate}%
          </p>
          <p className="text-xs text-muted-foreground">매칭률</p>
          {analysis.missingAtB > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              누락 {analysis.missingAtB}건
            </p>
          )}
        </div>
      </div>

      {/* 상세 정보 토글 */}
      <button
        className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? '▼ 상세 정보 접기' : '▶ 상세 정보 보기'}
      </button>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          {/* 데이터 요약 */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-sm font-semibold">{analysis.totalArrivalsAtA}</p>
              <p className="text-xs text-muted-foreground">A 도착</p>
            </div>
            <div>
              <p className="text-sm font-semibold">{analysis.totalArrivalsAtB}</p>
              <p className="text-xs text-muted-foreground">B 도착</p>
            </div>
            <div>
              <p className="text-sm font-semibold">{analysis.matchedCount}</p>
              <p className="text-xs text-muted-foreground">매칭됨</p>
            </div>
          </div>

          {/* 최근 매칭 기록 */}
          {analysis.recentMatches.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">최근 매칭 기록</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {analysis.recentMatches.map((match, i) => {
                  const dateA = new Date(match.arrivalAtA);
                  const timeA = dateA.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                  const dateStr = dateA.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });

                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1"
                    >
                      <span className="text-muted-foreground">{dateStr}</span>
                      <span>{timeA} → +{match.travelTimeMinutes}분</span>
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {match.plateNo.slice(-4)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {analysis.recentMatches.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              매칭된 기록이 없습니다. 차량번호(plate_no) 데이터가 필요합니다.
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
