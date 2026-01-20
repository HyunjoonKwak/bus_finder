'use client';

import { Card } from '@/components/ui/card';
import type { ArrivalLog, Pagination as PaginationType } from '@/types/stats';
import { Pagination } from './Pagination';

interface ArrivalLogsListProps {
  logs: ArrivalLog[];
  pagination: PaginationType | null;
  currentPage: number;
  logsPerPage: number;
  editMode: boolean;
  deletingId: string | null;
  logsLoading: boolean;
  onToggleEditMode: () => void;
  onDeleteLog: (logId: string) => void;
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
  onToggleEditMode,
  onDeleteLog,
  onPageChange,
}: ArrivalLogsListProps) {
  return (
    <Card className="p-4" role="region" aria-labelledby="logs-heading">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 id="logs-heading" className="font-semibold text-foreground">
            도착 기록
          </h2>
          {pagination && (
            <p className="text-xs text-muted-foreground" aria-live="polite">
              {pagination.totalLogs}건 중 {(currentPage - 1) * logsPerPage + 1}-
              {Math.min(currentPage * logsPerPage, pagination.totalLogs)}
            </p>
          )}
        </div>
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
      <div className="space-y-2">
        {logs.map((log) => {
          const date = new Date(log.arrival_time);
          const isDeleting = deletingId === log.id;
          return (
            <div
              key={log.id}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
            >
              <div className="flex items-center gap-2">
                {editMode && (
                  <button
                    onClick={() => onDeleteLog(log.id)}
                    disabled={isDeleting}
                    className="p-2 text-destructive hover:bg-destructive/10 rounded transition-colors disabled:opacity-50 min-w-[44px] min-h-[44px] flex items-center justify-center"
                    aria-label={`${date.toLocaleDateString('ko-KR')} 도착 기록 삭제`}
                  >
                    {isDeleting ? (
                      <div
                        className="w-5 h-5 border-2 border-destructive border-t-transparent rounded-full animate-spin"
                        aria-label="삭제 중"
                      />
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
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
                <span className="text-sm text-muted-foreground">
                  {date.toLocaleDateString('ko-KR', {
                    month: 'short',
                    day: 'numeric',
                    weekday: 'short',
                  })}
                </span>
              </div>
              <div className="text-right">
                <span className="font-semibold text-primary">
                  {date.toLocaleTimeString('ko-KR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </span>
                {log.plate_no && (
                  <span className="ml-2 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {log.plate_no}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {logs.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">기록이 없습니다.</p>
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
