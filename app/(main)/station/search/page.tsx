'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StationSearchInput } from '@/components/station/StationSearchInput';
import { StationList } from '@/components/station/StationList';
import type { StationInfo, NearbyStationInfo } from '@/lib/odsay/types';

export default function StationSearchPage() {
  const router = useRouter();
  const [searchResults, setSearchResults] = useState<StationInfo[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSelect = (station: StationInfo | NearbyStationInfo) => {
    router.push(`/station/${station.stationID}?name=${encodeURIComponent(station.stationName)}`);
  };

  const handleSearch = async (station: StationInfo) => {
    // 검색 결과를 클릭하면 바로 상세 페이지로 이동
    handleSelect(station);
  };

  return (
    <div className="px-4 py-4">
      <h1 className="text-xl font-bold text-slate-900 mb-4">정류소 검색</h1>

      <StationSearchInput
        onSelect={handleSearch}
        placeholder="정류소명을 입력하세요"
        className="mb-4"
      />

      {hasSearched && searchResults.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-slate-500">검색 결과가 없습니다.</p>
        </div>
      )}

      {searchResults.length > 0 && (
        <StationList stations={searchResults} onSelect={handleSelect} />
      )}

      {!hasSearched && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg
            className="w-16 h-16 text-slate-300 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <p className="text-slate-500">
            정류소명을 검색하여<br />
            도착 정보를 확인하세요
          </p>
        </div>
      )}
    </div>
  );
}
