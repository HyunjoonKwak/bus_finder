'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useSearchStore } from '@/lib/store';

export function SearchForm() {
  const router = useRouter();
  const { addRecentSearch } = useSearchStore();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination) return;

    addRecentSearch(origin, destination);
    router.push(`/search?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(destination)}`);
  };

  const handleSwap = () => {
    setOrigin(destination);
    setDestination(origin);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative">
        <Input
          type="text"
          placeholder="출발지를 입력하세요"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          className="pr-10"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500">
          출발
        </span>
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

      <div className="relative">
        <Input
          type="text"
          placeholder="도착지를 입력하세요"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
          className="pr-10"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">
          도착
        </span>
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
