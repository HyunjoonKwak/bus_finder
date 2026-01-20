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
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportContent, setExportContent] = useState('');
  const [copied, setCopied] = useState(false);

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

  const generateMarkdown = useCallback(() => {
    if (!analysis) return '';

    const now = new Date().toLocaleString('ko-KR');
    const lines: string[] = [
      `# 페어 정류장 분석 디버그 리포트`,
      ``,
      `> 생성일시: ${now}`,
      ``,
      `## 디버그 정보 (ID)`,
      ``,
      '```',
      `pair_id: ${pair.id}`,
      `bus_id: ${pair.busId}`,
      `bus_no: ${pair.busNo}`,
      `station_a_id: ${pair.stationA.id}`,
      `station_a_name: ${pair.stationA.name}`,
      `station_a_arsId: ${pair.stationA.arsId || 'null'}`,
      `station_b_id: ${pair.stationB.id}`,
      `station_b_name: ${pair.stationB.name}`,
      `station_b_arsId: ${pair.stationB.arsId || 'null'}`,
      `analysis_days: ${days}`,
      '```',
      ``,
      `## 기본 정보`,
      ``,
      `| 항목 | 값 |`,
      `|------|-----|`,
      `| 버스 | ${analysis.busNo} |`,
      `| A 정류장 | ${analysis.stationA} |`,
      `| B 정류장 | ${analysis.stationB} |`,
      `| 분석 기간 | ${analysis.period} |`,
      ``,
      `## 소요시간 통계`,
      ``,
      `| 항목 | 값 |`,
      `|------|-----|`,
      `| 평균 | ${analysis.avgTravelTime !== null ? `${analysis.avgTravelTime}분` : '-'} |`,
      `| 최소 | ${analysis.minTravelTime !== null ? `${analysis.minTravelTime}분` : '-'} |`,
      `| 최대 | ${analysis.maxTravelTime !== null ? `${analysis.maxTravelTime}분` : '-'} |`,
      `| 표준편차 | ${analysis.stdDevTravelTime !== null ? `${analysis.stdDevTravelTime}분` : '-'} |`,
      ``,
      `## 매칭 통계`,
      ``,
      `| 항목 | 값 |`,
      `|------|-----|`,
      `| A 정류장 도착 수 | ${analysis.totalArrivalsAtA}건 |`,
      `| B 정류장 도착 수 | ${analysis.totalArrivalsAtB}건 |`,
      `| 매칭 성공 | ${analysis.matchedCount}건 |`,
      `| 누락 | ${analysis.missingAtB}건 |`,
      `| 매칭률 | ${analysis.matchRate}% |`,
      ``,
    ];

    // 이슈 요약
    if (analysis.issuesSummary) {
      lines.push(`## 분석 이슈 요약`);
      lines.push(``);
      lines.push(`| 이슈 유형 | 건수 |`);
      lines.push(`|----------|------|`);
      lines.push(`| 중복 기록 | ${analysis.issuesSummary.duplicates}건 |`);
      lines.push(`| 매칭 실패 | ${analysis.issuesSummary.unmatched}건 |`);
      lines.push(`| 번호판 없음 | ${analysis.issuesSummary.noPlateNo}건 |`);
      lines.push(`| 시간 초과 | ${analysis.issuesSummary.timeout}건 |`);
      lines.push(``);
    }

    // 최근 매칭 기록
    if (analysis.recentMatches.length > 0) {
      lines.push(`## 최근 매칭 기록`);
      lines.push(``);
      lines.push(`| 날짜 | A 도착 | B 도착 | 소요시간 | 차량번호 |`);
      lines.push(`|------|--------|--------|----------|----------|`);

      for (const match of analysis.recentMatches) {
        const dateA = new Date(match.arrivalAtA);
        const dateB = new Date(match.arrivalAtB);
        const dateStr = dateA.toLocaleDateString('ko-KR');
        const timeA = dateA.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
        const timeB = dateB.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

        lines.push(`| ${dateStr} | ${timeA} | ${timeB} | ${match.travelTimeMinutes}분 | ${match.plateNo} |`);
      }
      lines.push(``);
    }

    // 상세 이슈 (있는 경우)
    if (analysis.issues && analysis.issues.length > 0) {
      lines.push(`## 상세 이슈 목록`);
      lines.push(``);
      lines.push(`| 유형 | 정류장 | 시간 | 설명 | 상세 | 차량번호 |`);
      lines.push(`|------|--------|------|------|------|----------|`);

      for (const issue of analysis.issues) {
        const time = new Date(issue.arrivalTime).toLocaleString('ko-KR');
        lines.push(`| ${issue.type} | ${issue.station} | ${time} | ${issue.description} | ${issue.details || '-'} | ${issue.plateNo || '-'} |`);
      }
      lines.push(``);
    }

    // 디버그용 SQL 쿼리 힌트
    lines.push(`## 디버그 SQL 쿼리`);
    lines.push(``);
    lines.push('```sql');
    lines.push(`-- A 정류장 도착 기록`);
    lines.push(`SELECT arrival_time, plate_no FROM bus_arrival_logs`);
    lines.push(`WHERE bus_id = '${pair.busId}' AND station_id = '${pair.stationA.id}'`);
    lines.push(`ORDER BY arrival_time DESC LIMIT 20;`);
    lines.push(``);
    lines.push(`-- B 정류장 도착 기록`);
    lines.push(`SELECT arrival_time, plate_no FROM bus_arrival_logs`);
    lines.push(`WHERE bus_id = '${pair.busId}' AND station_id = '${pair.stationB.id}'`);
    lines.push(`ORDER BY arrival_time DESC LIMIT 20;`);
    lines.push(``);
    lines.push(`-- 페어 설정 확인`);
    lines.push(`SELECT * FROM station_pairs WHERE id = '${pair.id}';`);
    lines.push('```');
    lines.push(``);
    lines.push(`---`);
    lines.push(`*Bus Finder 페어 분석 디버그 리포트*`);

    return lines.join('\n');
  }, [analysis, pair, days]);

  const openExportModal = () => {
    const content = generateMarkdown();
    setExportContent(content);
    setShowExportModal(true);
    setCopied(false);
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(exportContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert('복사에 실패했습니다.');
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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-primary"
            onClick={openExportModal}
            aria-label="디버그 리포트 보기"
            title="디버그 리포트"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </Button>
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

          {/* 분석 이슈 요약 */}
          {analysis.issuesSummary && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">📊 분석 이슈</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {analysis.issuesSummary.duplicates > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <span>⚠️</span>
                    <span>중복 기록: {analysis.issuesSummary.duplicates}건</span>
                  </div>
                )}
                {analysis.issuesSummary.unmatched > 0 && (
                  <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                    <span>❌</span>
                    <span>매칭 실패: {analysis.issuesSummary.unmatched}건</span>
                  </div>
                )}
                {analysis.issuesSummary.noPlateNo > 0 && (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span>🚫</span>
                    <span>번호판 없음: {analysis.issuesSummary.noPlateNo}건</span>
                  </div>
                )}
                {analysis.issuesSummary.boundary > 0 && (
                  <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                    <span>🚌</span>
                    <span>첫차/막차: {analysis.issuesSummary.boundary}건</span>
                  </div>
                )}
                {analysis.issuesSummary.diffDay > 0 && (
                  <div className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
                    <span>📅</span>
                    <span>다른 날: {analysis.issuesSummary.diffDay}건</span>
                  </div>
                )}
              </div>
              {Object.values(analysis.issuesSummary).every(v => v === 0) && (
                <p className="text-xs text-green-600 dark:text-green-400">✅ 이슈 없음</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 디버그 리포트 모달 */}
      {showExportModal && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowExportModal(false)}
        >
          <div
            className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">디버그 리포트</h3>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={copied ? 'default' : 'outline'}
                  onClick={copyToClipboard}
                >
                  {copied ? '✓ 복사됨' : '📋 복사'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowExportModal(false)}
                >
                  ✕
                </Button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-xs font-mono whitespace-pre-wrap bg-muted p-3 rounded-lg">
                {exportContent}
              </pre>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
