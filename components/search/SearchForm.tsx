'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useSearchStore } from '@/lib/store';
import { PlaceSearchInput } from './PlaceSearchInput';

interface SelectedPlace {
  name: string;
  x: string;
  y: string;
}

interface SearchFormContentProps {
  variant?: 'default' | 'compact';
  onSearch?: (origin: string, dest: string, params?: { sx?: string; sy?: string; ex?: string; ey?: string }) => void;
}

function SearchFormContent({ variant = 'default', onSearch }: SearchFormContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addRecentSearch } = useSearchStore();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [originPlace, setOriginPlace] = useState<SelectedPlace | null>(null);
  const [destPlace, setDestPlace] = useState<SelectedPlace | null>(null);

  // URL 파라미터에서 선택된 위치 정보 가져오기
  useEffect(() => {
    const sname = searchParams.get('sname');
    const ename = searchParams.get('ename');
    const sx = searchParams.get('sx');
    const sy = searchParams.get('sy');
    const ex = searchParams.get('ex');
    const ey = searchParams.get('ey');

    if (sname) {
      setOrigin(sname);
      if (sx && sy) {
        setOriginPlace({ name: sname, x: sx, y: sy });
      }
    }
    if (ename) {
      setDestination(ename);
      if (ex && ey) {
        setDestPlace({ name: ename, x: ex, y: ey });
      }
    }
  }, [searchParams]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!origin || !destination) return;

    addRecentSearch(origin, destination);

    // onSearch 콜백이 있으면 직접 호출, 없으면 페이지 이동
    if (onSearch) {
      const params: { sx?: string; sy?: string; ex?: string; ey?: string } = {};
      if (originPlace) {
        params.sx = originPlace.x;
        params.sy = originPlace.y;
      }
      if (destPlace) {
        params.ex = destPlace.x;
        params.ey = destPlace.y;
      }
      onSearch(origin, destination, Object.keys(params).length > 0 ? params : undefined);
    } else {
      // 좌표가 있으면 함께 전달
      let url = `/search?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(destination)}`;
      if (originPlace) {
        url += `&sx=${originPlace.x}&sy=${originPlace.y}`;
      }
      if (destPlace) {
        url += `&ex=${destPlace.x}&ey=${destPlace.y}`;
      }

      router.push(url);
    }
  };

  const handleSwap = () => {
    const tempOrigin = origin;
    const tempOriginPlace = originPlace;
    setOrigin(destination);
    setOriginPlace(destPlace);
    setDestination(tempOrigin);
    setDestPlace(tempOriginPlace);
  };

  const handleMapSelect = (field: 'origin' | 'dest') => {
    const params = new URLSearchParams();
    params.set('field', field);
    params.set('returnTo', '/');

    if (originPlace) {
      params.set('sx', originPlace.x);
      params.set('sy', originPlace.y);
    }
    if (origin) params.set('sname', origin);
    if (destPlace) {
      params.set('ex', destPlace.x);
      params.set('ey', destPlace.y);
    }
    if (destination) params.set('ename', destination);

    router.push(`/map-select?${params.toString()}`);
  };

  const handleOriginSelect = (place: { name: string; x: string; y: string }) => {
    setOriginPlace({ name: place.name, x: place.x, y: place.y });
  };

  const handleDestSelect = (place: { name: string; x: string; y: string }) => {
    setDestPlace({ name: place.name, x: place.x, y: place.y });
  };

  const handleOriginChange = (value: string) => {
    setOrigin(value);
    // 텍스트가 변경되면 기존 선택된 장소 초기화
    if (originPlace && value !== originPlace.name) {
      setOriginPlace(null);
    }
  };

  const handleDestChange = (value: string) => {
    setDestination(value);
    if (destPlace && value !== destPlace.name) {
      setDestPlace(null);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="relative flex gap-2">
        <PlaceSearchInput
          value={origin}
          onChange={handleOriginChange}
          onSelect={handleOriginSelect}
          placeholder="출발지를 입력하세요"
          label="출발"
          labelColor="text-primary"
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => handleMapSelect('origin')}
          className="flex-shrink-0 p-2 border border-border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
          title="지도에서 선택"
        >
          <MapIcon className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={handleSwap}
          className="rounded-full p-2 hover:bg-accent hover:text-accent-foreground transition-colors"
        >
          <SwapIcon className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      <div className="relative flex gap-2">
        <PlaceSearchInput
          value={destination}
          onChange={handleDestChange}
          onSelect={handleDestSelect}
          placeholder="도착지를 입력하세요"
          label="도착"
          labelColor="text-destructive"
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => handleMapSelect('dest')}
          className="flex-shrink-0 p-2 border border-border rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
          title="지도에서 선택"
        >
          <MapIcon className="h-5 w-5 text-muted-foreground" />
        </button>
      </div>

      <Button
        type="submit"
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5"
        disabled={!origin || !destination}
      >
        경로 검색
      </Button>
    </form>
  );
}

interface SearchFormProps {
  variant?: 'default' | 'compact';
  onSearch?: (origin: string, dest: string, params?: { sx?: string; sy?: string; ex?: string; ey?: string }) => void;
}

export function SearchForm({ variant = 'default', onSearch }: SearchFormProps) {
  return (
    <Suspense
      fallback={
        <div className="space-y-3">
          <div className="h-10 bg-muted rounded-md animate-pulse" />
          <div className="flex justify-center">
            <div className="w-9 h-9 bg-muted rounded-full animate-pulse" />
          </div>
          <div className="h-10 bg-muted rounded-md animate-pulse" />
          <div className="h-10 bg-muted rounded-md animate-pulse" />
        </div>
      }
    >
      <SearchFormContent variant={variant} onSearch={onSearch} />
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
