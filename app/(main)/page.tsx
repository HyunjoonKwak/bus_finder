'use client';

import { MapContainer } from '@/components/map/MapContainer';
import { SearchForm } from '@/components/search/SearchForm';
import { FilterOptions } from '@/components/search/FilterOptions';
import { Card } from '@/components/ui/card';
import { useSearchStore } from '@/lib/store';

export default function HomePage() {
  const { recentSearches } = useSearchStore();

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-background">
      <MapContainer className="absolute inset-0 z-0 h-full w-full" />

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end p-4 pb-8 sm:p-6 md:justify-center md:pb-12 lg:items-center">
        <Card className="mx-auto w-full max-w-md animate-in slide-in-from-bottom-10 fade-in duration-500 border-white/20 bg-background/80 shadow-2xl backdrop-blur-xl dark:bg-slate-900/60 dark:border-white/10">
          <div className="p-4 sm:p-6">
            <SearchForm />
            <div className="mt-4 sm:mt-6">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">검색 조건</p>
              <FilterOptions />
            </div>
          </div>
        </Card>

        {recentSearches.length > 0 && (
          <div className="mx-auto mt-4 w-full max-w-md animate-in slide-in-from-bottom-12 fade-in duration-700 delay-100">
            <h2 className="mb-2 px-1 text-xs font-semibold text-white/90 drop-shadow-md sm:text-slate-700 sm:drop-shadow-none dark:text-slate-300">
              최근 검색
            </h2>
            <div className="space-y-2">
              {recentSearches.slice(0, 2).map((search, index) => (
                <Card 
                  key={index} 
                  className="group flex items-center justify-between border-white/20 bg-white/70 p-3 shadow-lg backdrop-blur-md transition-all hover:bg-white/90 dark:bg-slate-900/60 dark:border-white/10 dark:hover:bg-slate-800/80"
                >
                  <div className="flex items-center text-sm font-medium">
                    <span className="text-emerald-600 dark:text-emerald-400">{search.origin}</span>
                    <span className="mx-2 text-muted-foreground/60">→</span>
                    <span className="text-rose-500 dark:text-rose-400">{search.destination}</span>
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
