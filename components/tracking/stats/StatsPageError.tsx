'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface StatsPageErrorProps {
  error: string;
  onRetry: () => void;
  onBack: () => void;
}

export function StatsPageError({ error, onRetry, onBack }: StatsPageErrorProps) {
  return (
    <div className="px-4 py-4">
      <button
        onClick={onBack}
        className="flex items-center text-muted-foreground mb-4"
      >
        <svg
          className="w-5 h-5 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        돌아가기
      </button>

      <Card className="p-6 bg-destructive/10 border-destructive/30">
        <div className="flex flex-col items-center text-center">
          <svg
            className="w-12 h-12 text-destructive mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h2 className="text-lg font-semibold text-destructive mb-2">
            데이터를 불러올 수 없습니다
          </h2>
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Button onClick={onRetry} variant="outline">
            다시 시도
          </Button>
        </div>
      </Card>
    </div>
  );
}
