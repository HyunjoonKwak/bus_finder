'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSearchStore } from '@/lib/store';

function SearchFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addRecentSearch } = useSearchStore();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');

  // URL 파라미터에서 선택된 위치 정보 가져오기
  useEffect(() => {
    const sname = searchParams.get('sname');
    const ename = searchParams.get('ename');

    if (sname) setOrigin(sname);
    if (ename) setDestination(ename);
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination) return;

    addRecentSearch(origin, destination);

    // 좌표가 있으면 함께 전달
    const sx = searchParams.get('sx');
    const sy = searchParams.get('sy');
    const ex = searchParams.get('ex');
    const ey = searchParams.get('ey');

    let url = `/search?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(destination)}`;
    if (sx && sy) url += `&sx=${sx}&sy=${sy}`;
    if (ex && ey) url += `&ex=${ex}&ey=${ey}`;

    router.push(url);
  };

  const handleSwap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  const handleMapSelect = (field: 'origin' | 'dest') => {
    const params = new URLSearchParams();
    params.set('field', field);
    params.set('returnTo', '/');

    // 기존 좌표 유지
    const sx = searchParams.get('sx');
    const sy = searchParams.get('sy');
    const ex = searchParams.get('ex');
    const ey = searchParams.get('ey');

    if (sx) params.set('sx', sx);
    if (sy) params.set('sy', sy);
    if (origin) params.set('sname', origin);
    if (ex) params.set('ex', ex);
    if (ey) params.set('ey', ey);
    if (destination) params.set('ename', destination);

    router.push(`/map-select?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative flex gap-2">
        <div className="flex-1 relative">
          <Input
            type="text"
            placeholder="출발지를 입력하세요"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            className="pr-12"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500 text-xs">
            출발
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleMapSelect('origin')}
          className="flex-shrink-0 p-2 border border-slate-200 rounded-md hover:bg-slate-50"
          title="지도에서 선택"
        >
          <MapIcon className="h-5 w-5 text-slate-500" />
        </button>
      </div>

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={handleSwap}
          className="rounded-full p-2 hover:bg-slate-100"
        >
          <SwapIcon className="h-5 w-5 text-slate-500" />
        </button>
      </div>

      <div className="relative flex gap-2">
        <div className="flex-1 relative">
          <Input
            type="text"
            placeholder="도착지를 입력하세요"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="pr-12"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-xs">
            도착
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleMapSelect('dest')}
          className="flex-shrink-0 p-2 border border-slate-200 rounded-md hover:bg-slate-50"
          title="지도에서 선택"
        >
          <MapIcon className="h-5 w-5 text-slate-500" />
        </button>
      </div>

      <Button
        type="submit"
        className="w-full bg-emerald-500 hover:bg-emerald-600"
        disabled={!origin || !destination}
      >
        경로 검색
      </Button>
    </form>
  );
}

export function SearchForm() {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <div className="h-10 bg-slate-100 rounded-md animate-pulse" />
          <div className="flex justify-center">
            <div className="w-9 h-9 bg-slate-100 rounded-full animate-pulse" />
          </div>
          <div className="h-10 bg-slate-100 rounded-md animate-pulse" />
          <div className="h-10 bg-slate-100 rounded-md animate-pulse" />
        </div>
      }
    >
      <SearchFormContent />
    </Suspense>
  );
}

function SwapIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
      />
    </svg>
  );
}

function MapIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
      />
    </svg>
  );
}
