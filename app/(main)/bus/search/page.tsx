'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BusSearchInput } from '@/components/bus/BusSearchInput';
import { BusRouteCard } from '@/components/bus/BusRouteCard';
import type { BusLaneInfo } from '@/lib/odsay/types';

export default function BusSearchPage() {
  const router = useRouter();
  const [searchResults, _setSearchResults] = useState<BusLaneInfo[]>([]);
  const [hasSearched, _setHasSearched] = useState(false);

  const handleSelect = (bus: BusLaneInfo) => {
    router.push(`/bus/${bus.busID}?no=${encodeURIComponent(bus.busNo)}`);
  };

  return (
    <div className="px-4 py-4">
      <h1 className="text-xl font-bold text-foreground mb-4">버스 노선 검색</h1>

      <BusSearchInput
        onSelect={handleSelect}
        placeholder="버스 번호를 입력하세요"
        className="mb-4"
      />

      {hasSearched && searchResults.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-muted-foreground">검색 결과가 없습니다.</p>
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="space-y-2">
          {searchResults.map((bus) => (
            <BusRouteCard
              key={bus.busID}
              bus={bus}
              onClick={() => handleSelect(bus)}
            />
          ))}
        </div>
      )}

      {!hasSearched && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg
            className="w-16 h-16 text-muted-foreground/50 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          <p className="text-muted-foreground">
            버스 번호를 검색하여<br />
            노선 정보를 확인하세요
          </p>
        </div>
      )}
    </div>
  );
}
