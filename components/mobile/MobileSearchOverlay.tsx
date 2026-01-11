'use client';

import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { StationSearchInput } from '@/components/station/StationSearchInput';
import { BusSearchInput } from '@/components/bus/BusSearchInput';
import type { StationInfo, BusLaneInfo } from '@/lib/odsay/types';

type SearchMode = 'station' | 'bus' | 'search' | 'tracking';

interface MobileSearchOverlayProps {
  isOpen: boolean;
  mode: SearchMode;
  onClose: () => void;
  onSelectStation: (station: StationInfo) => void;
  onSelectBus: (bus: BusLaneInfo) => void;
}

export function MobileSearchOverlay({
  isOpen,
  mode,
  onClose,
  onSelectStation,
  onSelectBus,
}: MobileSearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <button
          onClick={onClose}
          className="p-2 -ml-1 rounded-full hover:bg-accent"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1">
          {mode === 'station' && (
            <StationSearchInput
              onSelect={(station) => {
                onSelectStation(station as StationInfo);
                onClose();
              }}
              placeholder="정류소명 또는 번호 입력"
              className="border-0 shadow-none bg-transparent"
            />
          )}
          {mode === 'bus' && (
            <BusSearchInput
              onSelect={(bus) => {
                onSelectBus(bus);
                onClose();
              }}
              placeholder="버스 번호 입력"
              className="border-0 shadow-none bg-transparent"
            />
          )}
          {mode === 'search' && (
            <input
              ref={inputRef}
              type="text"
              placeholder="목적지를 입력하세요"
              className="w-full px-3 py-2 bg-transparent outline-none"
              autoFocus
            />
          )}
          {mode === 'tracking' && (
            <div className="px-3 py-2 text-muted-foreground">
              추적 중인 버스 목록
            </div>
          )}
        </div>
      </div>

      {/* Content area for search results - handled by search inputs */}
      <div className="flex-1 overflow-y-auto">
        {mode === 'tracking' && (
          <div className="p-4 text-center text-muted-foreground">
            추적 기능은 정류소에서 버스를 선택하면 추가할 수 있습니다.
          </div>
        )}
      </div>
    </div>
  );
}
