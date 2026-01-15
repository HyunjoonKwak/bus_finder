'use client';

import { useRouter } from 'next/navigation';

interface MapHeaderProps {
  onSearchClick?: () => void;
}

export function MapHeader({ onSearchClick }: MapHeaderProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onSearchClick) {
      onSearchClick();
    } else {
      router.push('/search-unified');
    }
  };

  return (
    <div className="absolute top-0 left-0 right-0 z-10 p-3">
      <button
        onClick={handleClick}
        className="w-full bg-background/95 backdrop-blur-sm rounded-full px-4 py-2.5 shadow-lg border border-border/50 flex items-center gap-3 hover:bg-accent/50 transition-colors"
      >
        <svg
          className="w-5 h-5 text-muted-foreground flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <span className="text-sm text-muted-foreground flex-1 text-left">
          장소, 버스, 정류소 검색
        </span>
      </button>
    </div>
  );
}
