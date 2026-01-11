'use client';

import { useState } from 'react';
import { Search, MapPin, Bus, Navigation, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

type SearchMode = 'station' | 'bus' | 'search' | 'tracking';

interface MobileSearchBarProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  onSearchFocus: () => void;
  onCurrentLocation: () => void;
}

export function MobileSearchBar({
  mode,
  onModeChange,
  onSearchFocus,
  onCurrentLocation
}: MobileSearchBarProps) {
  const getModeIcon = () => {
    switch (mode) {
      case 'station': return <MapPin className="w-4 h-4" />;
      case 'bus': return <Bus className="w-4 h-4" />;
      case 'search': return <Navigation className="w-4 h-4" />;
      case 'tracking': return <Bell className="w-4 h-4" />;
    }
  };

  const getPlaceholder = () => {
    switch (mode) {
      case 'station': return '정류소 검색';
      case 'bus': return '버스 번호 검색';
      case 'search': return '목적지 검색';
      case 'tracking': return '추적 중인 버스';
    }
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 p-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
      {/* Mode selector pills */}
      <div className="flex gap-1.5 mb-2 overflow-x-auto scrollbar-hide">
        {([
          { id: 'station', label: '정류소', icon: MapPin },
          { id: 'bus', label: '노선', icon: Bus },
          { id: 'search', label: '길찾기', icon: Navigation },
          { id: 'tracking', label: '추적', icon: Bell },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => onModeChange(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
              mode === id
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-white/90 dark:bg-black/70 text-foreground shadow-sm border border-border/50"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex gap-2">
        <button
          onClick={onSearchFocus}
          className="flex-1 flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-border/30"
        >
          <Search className="w-5 h-5 text-muted-foreground" />
          <span className="text-muted-foreground text-sm">{getPlaceholder()}</span>
        </button>

        <button
          onClick={onCurrentLocation}
          className="flex items-center justify-center w-12 h-12 bg-white dark:bg-gray-900 rounded-xl shadow-lg border border-border/30"
          aria-label="현재 위치"
        >
          <MapPin className="w-5 h-5 text-primary" />
        </button>
      </div>
    </div>
  );
}
