'use client';

import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import type { ArrivalLog, Pagination as PaginationType } from '@/types/stats';
import { Pagination } from './Pagination';

interface DateGroup {
  date: string;
  dateLabel: string;
  weekday: string;
  logs: ArrivalLog[];
}

interface ArrivalLogsListProps {
  logs: ArrivalLog[];
  pagination: PaginationType | null;
  currentPage: number;
  logsPerPage: number;
  editMode: boolean;
  deletingId: string | null;
  logsLoading: boolean;
  busId?: string;
  stationId?: string;
  onToggleEditMode: () => void;
  onDeleteLog: (logId: string) => void;
  onDeleteByDate?: (date: string) => void;
  onPageChange: (page: number) => void;
}

export function ArrivalLogsList({
  logs,
  pagination,
  currentPage,
  logsPerPage,
  editMode,
  deletingId,
  logsLoading,
  busId,
  stationId,
  onToggleEditMode,
  onDeleteLog,
  onDeleteByDate,
  onPageChange,
}: ArrivalLogsListProps) {
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [deletingDate, setDeletingDate] = useState<string | null>(null);

  // 날짜별로 그룹화
  const groupedByDate = useMemo(() => {
    const groups: DateGroup[] = [];
    const dateMap = new Map<string, ArrivalLog[]>();

    logs.forEach((log) => {
      const date = new Date(log.arrival_time);
      const dateKey = date.toISOString().split('T')[0];

      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(log);
    });

    dateMap.forEach((dateLogs, dateKey) => {
      const date = new Date(dateKey);
      groups.push({
        date: dateKey,
        dateLabel: date.toLocaleDateString('ko-KR', {
          month: 'long',
          day: 'numeric',
        }),
        weekday: date.toLocaleDateString('ko-KR', { weekday: 'short' }),
        logs: dateLogs.sort(
          (a, b) =>
            new Date(b.arrival_time).getTime() - new Date(a.arrival_time).getTime()
        ),
      });
    });

    return groups.sort((a, b) => b.date.localeCompare(a.date));
  }, [logs]);

  const toggleDate = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const handleDeleteByDate = async (date: string) => {
    if (!onDeleteByDate) return;

    const confirmMessage = `${new Date(date).toLocaleDateString('ko-KR')} 날짜의 모든 기록을 삭제하시겠습니까?`;
    if (!window.confirm(confirmMessage)) return;

    setDeletingDate(date);
    try {
      await onDeleteByDate(date);
    } finally {
      setDeletingDate(null);
    }
  };

  // 모든 날짜 펼치기/접기
  const toggleAll = () => {
    if (expandedDates.size === groupedByDate.length) {
      setExpandedDates(new Set());
    } else {
      setExpandedDates(new Set(groupedByDate.map((g) => g.date)));
    }
  };

  const allExpanded = expandedDates.size === groupedByDate.length && groupedByDate.length > 0;

  return (
    <Card className="p-4" role="region" aria-labelledby="logs-heading">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 id="logs-heading" className="font-semibold text-foreground">
            도착 기록
          </h2>
          {pagination && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              총 {pagination.totalLogs}건 · {groupedByDate.length}일
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {groupedByDate.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label={allExpanded ? '모두 접기' : '모두 펼치기'}
            >
              {allExpanded ? '모두 접기' : '모두 펼치기'}
            </button>
          )}
          <button
            onClick={onToggleEditMode}
            className={`text-sm px-3 py-2 rounded transition-colors min-w-[44px] min-h-[44px] ${
              editMode
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            aria-pressed={editMode}
            aria-label={editMode ? '편집 모드 종료' : '편집 모드 시작'}
          >
            {editMode ? '완료' : '편집'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {groupedByDate.map((group) => {
          const isExpanded = expandedDates.has(group.date);
          const isDeletingThisDate = deletingDate === group.date;

          return (
            <div
              key={group.date}
              className="border border-border rounded-lg overflow-hidden"
            >
              {/* 날짜 헤더 */}
              <button
                onClick={() => toggleDate(group.date)}
                className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors"
                aria-expanded={isExpanded}
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 text-muted-foreground transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                  <span className="font-medium text-foreground">
                    {group.dateLabel}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    ({group.weekday})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-primary">
                    {group.logs.length}건
                  </span>
                  {editMode && onDeleteByDate && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteByDate(group.date);
                      }}
                      disabled={isDeletingThisDate}
                      className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                      aria-label={`${group.dateLabel} 전체 삭제`}
                    >
                      {isDeletingThisDate ? (
                        <div className="w-4 h-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      )}
                    </button>
                  )}
                </div>
              </button>

              {/* 날짜별 상세 기록 */}
              {isExpanded && (
                <div className="border-t border-border">
                  {group.logs.map((log) => {
                    const date = new Date(log.arrival_time);
                    const isDeleting = deletingId === log.id;

                    return (
                      <div
                        key={log.id}
                        className="flex items-center justify-between py-2 px-3 border-b border-border last:border-0 hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-2">
                          {editMode && (
                            <button
                              onClick={() => onDeleteLog(log.id)}
                              disabled={isDeleting}
                              className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50"
                              aria-label={`${date.toLocaleTimeString('ko-KR')} 기록 삭제`}
                            >
                              {isDeleting ? (
                                <div className="w-4 h-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              )}
                            </button>
                          )}
                          <span className="font-semibold text-primary">
                            {date.toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: false,
                            })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {log.plate_no && (
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {log.plate_no}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {logs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          기록이 없습니다.
        </p>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={pagination.totalPages}
          isLoading={logsLoading}
          onPageChange={onPageChange}
        />
      )}
    </Card>
  );
}
