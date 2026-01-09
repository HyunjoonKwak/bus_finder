'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MapWithClick } from '@/components/map/MapWithClick';

interface SelectedLocation {
  lat: number;
  lng: number;
  address: string;
  placeName?: string;
}

function MapSelectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const returnTo = searchParams.get('returnTo') || '/search';
  const field = searchParams.get('field') || 'origin'; // origin 또는 dest

  const handleSelect = (location: SelectedLocation) => {
    // 선택된 위치 정보를 URL 파라미터로 전달
    const params = new URLSearchParams();

    if (field === 'origin') {
      params.set('sx', location.lng.toString());
      params.set('sy', location.lat.toString());
      params.set('sname', location.address);
    } else {
      params.set('ex', location.lng.toString());
      params.set('ey', location.lat.toString());
      params.set('ename', location.address);
    }

    // 기존 파라미터 유지
    const currentSx = searchParams.get('sx');
    const currentSy = searchParams.get('sy');
    const currentSname = searchParams.get('sname');
    const currentEx = searchParams.get('ex');
    const currentEy = searchParams.get('ey');
    const currentEname = searchParams.get('ename');

    if (field === 'dest' && currentSx && currentSy && currentSname) {
      params.set('sx', currentSx);
      params.set('sy', currentSy);
      params.set('sname', currentSname);
    } else if (field === 'origin' && currentEx && currentEy && currentEname) {
      params.set('ex', currentEx);
      params.set('ey', currentEy);
      params.set('ename', currentEname);
    }

    router.push(`${returnTo}?${params.toString()}`);
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <h1 className="text-lg font-bold text-slate-900">
          {field === 'origin' ? '출발지' : '도착지'} 선택
        </h1>
        <p className="text-xs text-slate-500">
          지도를 클릭하여 위치를 선택하세요
        </p>
      </div>
      <MapWithClick
        className="flex-1"
        onSelect={handleSelect}
        onCancel={handleCancel}
      />
    </div>
  );
}

export default function MapSelectPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <MapSelectContent />
    </Suspense>
  );
}
