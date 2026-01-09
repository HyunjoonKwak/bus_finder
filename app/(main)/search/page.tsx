'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface RouteResult {
  id: string;
  origin: { name: string };
  destination: { name: string };
  totalTime: number;
  walkTime: number;
  transferCount: number;
  fare: number;
  legs: Array<{
    mode: string;
    duration: number;
    routeName?: string;
    startName: string;
    endName: string;
    stationCount?: number;
  }>;
  pathType?: number;
}

function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const origin = searchParams.get('origin');
  const dest = searchParams.get('dest');

  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!origin || !dest) return;

    const fetchRoutes = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/search?origin=${encodeURIComponent(origin)}&dest=${encodeURIComponent(dest)}`
        );
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || '경로 검색에 실패했습니다.');
          return;
        }

        setRoutes(data.routes || []);
      } catch (err) {
        setError('경로 검색 중 오류가 발생했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchRoutes();
  }, [origin, dest]);

  if (!origin || !dest) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-slate-500">출발지와 도착지를 입력해주세요.</p>
      </div>
    );
  }

  if (loading) {
    return <SearchLoading />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <p className="text-red-500 mb-4">{error}</p>
        <Button variant="outline" onClick={() => router.back()}>
          돌아가기
        </Button>
      </div>
    );
  }

  if (routes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-slate-500">검색 결과가 없습니다.</p>
      </div>
    );
  }

  // 경로 요약 텍스트 생성
  const getRouteSummary = (legs: RouteResult['legs']) => {
    return legs
      .filter((leg) => leg.mode !== 'walk')
      .map((leg) => {
        if (leg.mode === 'bus') return `${leg.routeName}번 버스`;
        if (leg.mode === 'subway') return leg.routeName;
        return leg.routeName;
      })
      .join(' → ');
  };

  // 경로 타입 뱃지
  const getPathTypeBadge = (pathType?: number) => {
    switch (pathType) {
      case 1:
        return <Badge className="bg-green-500">지하철</Badge>;
      case 2:
        return <Badge className="bg-blue-500">버스</Badge>;
      case 3:
        return <Badge className="bg-purple-500">버스+지하철</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="px-4 py-4">
      <div className="mb-4">
        <div className="flex items-center text-sm">
          <span className="text-emerald-500 font-medium">{origin}</span>
          <span className="mx-2 text-slate-400">→</span>
          <span className="text-red-500 font-medium">{dest}</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          {routes.length}개의 경로를 찾았습니다
        </p>
      </div>

      <div className="space-y-3">
        {routes.map((route) => (
          <Card key={route.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl font-bold text-slate-900">
                    {route.totalTime}분
                  </span>
                  <Badge variant="outline" className="text-xs">
                    환승 {route.transferCount}회
                  </Badge>
                  {getPathTypeBadge(route.pathType)}
                </div>
                <p className="text-sm text-slate-600 mb-2">
                  {getRouteSummary(route.legs) || '도보 경로'}
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>도보 {route.walkTime}분</span>
                  <span>요금 {(route.fare || 0).toLocaleString()}원</span>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-emerald-500 hover:bg-emerald-600"
                onClick={() => {
                  // 경로 상세 정보를 sessionStorage에 저장
                  sessionStorage.setItem('selectedRoute', JSON.stringify(route));
                  router.push(`/routes/${route.id}`);
                }}
              >
                상세보기
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchLoading />}>
      <SearchResults />
    </Suspense>
  );
}

function SearchLoading() {
  return (
    <div className="px-4 py-4 space-y-3">
      <div className="mb-4">
        <div className="h-4 w-48 bg-slate-200 rounded animate-pulse" />
      </div>
      {[1, 2, 3].map((i) => (
        <Card key={i} className="p-4 animate-pulse">
          <div className="h-6 w-20 bg-slate-200 rounded mb-2" />
          <div className="h-4 w-48 bg-slate-200 rounded mb-2" />
          <div className="h-3 w-32 bg-slate-200 rounded" />
        </Card>
      ))}
    </div>
  );
}
