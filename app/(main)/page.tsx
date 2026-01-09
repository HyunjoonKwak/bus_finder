'use client';

import { MapContainer } from '@/components/map/MapContainer';
import { SearchForm } from '@/components/search/SearchForm';
import { FilterOptions } from '@/components/search/FilterOptions';
import { Card } from '@/components/ui/card';
import { useSearchStore } from '@/lib/store';

export default function HomePage() {
  const { recentSearches } = useSearchStore();

  return (
    <div className="flex flex-col">
      {/* 지도 영역 */}
      <MapContainer className="h-48 w-full" />

      {/* 검색 영역 */}
      <div className="px-4 py-4">
        <Card className="p-4">
          <SearchForm />
          <div className="mt-4">
            <p className="mb-2 text-sm text-slate-500">검색 조건</p>
            <FilterOptions />
          </div>
        </Card>

        {/* 최근 검색어 */}
        {recentSearches.length > 0 && (
          <div className="mt-4">
            <h2 className="mb-2 text-sm font-medium text-slate-700">최근 검색</h2>
            <div className="space-y-2">
              {recentSearches.map((search, index) => (
                <Card key={index} className="p-3">
                  <div className="flex items-center text-sm">
                    <span className="text-emerald-500">{search.origin}</span>
                    <span className="mx-2 text-slate-400">→</span>
                    <span className="text-red-500">{search.destination}</span>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
