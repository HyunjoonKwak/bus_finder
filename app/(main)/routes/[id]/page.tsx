'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapContainer } from '@/components/map/MapContainer';
import { createClient } from '@/lib/supabase/client';

interface RouteData {
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
}

export default function RouteDetailPage() {
  const router = useRouter();
  const [route, setRoute] = useState<RouteData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // sessionStorage에서 경로 정보 가져오기
    const savedRoute = sessionStorage.getItem('selectedRoute');
    if (savedRoute) {
      setRoute(JSON.parse(savedRoute));
    }
  }, []);

  const handleStartRide = async () => {
    if (!route) return;

    setSaving(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        alert('로그인이 필요합니다.');
        router.push('/login');
        return;
      }

      const { error } = await supabase.from('transport_history').insert({
        user_id: user.id,
        origin_name: route.origin.name,
        dest_name: route.destination.name,
        route_data: route,
        total_time: route.totalTime,
      });

      if (error) {
        console.error('Failed to save history:', error);
        alert('기록 저장에 실패했습니다.');
        return;
      }

      setSaved(true);
      alert('탑승 기록이 저장되었습니다!');
    } catch (err) {
      console.error('Error saving history:', err);
      alert('오류가 발생했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'walk':
        return '🚶';
      case 'bus':
        return '🚌';
      case 'subway':
        return '🚇';
      default:
        return '📍';
    }
  };

  const getModeColor = (mode: string) => {
    switch (mode) {
      case 'walk':
        return 'text-slate-500';
      case 'bus':
        return 'text-blue-500';
      case 'subway':
        return 'text-green-500';
      default:
        return 'text-slate-500';
    }
  };

  const getLegDescription = (leg: RouteData['legs'][0]) => {
    if (leg.mode === 'walk') {
      return `${leg.startName}에서 ${leg.endName}까지 도보`;
    }
    if (leg.mode === 'bus') {
      return `${leg.routeName}번 버스 (${leg.startName} → ${leg.endName})`;
    }
    if (leg.mode === 'subway') {
      return `${leg.routeName} (${leg.startName} → ${leg.endName})`;
    }
    return `${leg.startName} → ${leg.endName}`;
  };

  if (!route) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-slate-500">경로 정보를 불러오는 중...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* 지도 영역 */}
      <MapContainer className="h-48 w-full" />

      <div className="px-4 py-4">
        {/* 요약 정보 */}
        <Card className="p-4 mb-4">
          <div className="flex items-center text-sm mb-3">
            <span className="text-emerald-500 font-medium">
              {route.origin.name}
            </span>
            <span className="mx-2 text-slate-400">→</span>
            <span className="text-red-500 font-medium">
              {route.destination.name}
            </span>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl font-bold text-slate-900">
              {route.totalTime}분
            </span>
            <Badge variant="outline">환승 {route.transferCount}회</Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>도보 {route.walkTime}분</span>
            <span>요금 {(route.fare || 0).toLocaleString()}원</span>
          </div>
        </Card>

        {/* 탑승 시작 버튼 */}
        <Button
          className={`w-full mb-4 ${saved ? 'bg-slate-400' : 'bg-emerald-500 hover:bg-emerald-600'}`}
          onClick={handleStartRide}
          disabled={saving || saved}
        >
          {saving ? '저장 중...' : saved ? '기록됨 ✓' : '탑승 시작'}
        </Button>

        {/* 상세 경로 */}
        <h2 className="text-sm font-medium text-slate-700 mb-3">상세 경로</h2>
        <div className="space-y-0">
          {route.legs.map((leg, index) => (
            <div key={index} className="flex items-start">
              <div className="flex flex-col items-center mr-3">
                <span className="text-lg">{getModeIcon(leg.mode)}</span>
                {index < route.legs.length - 1 && (
                  <div className="w-0.5 h-12 bg-slate-200 my-1" />
                )}
              </div>
              <div className="flex-1 pb-4">
                <p className={`font-medium ${getModeColor(leg.mode)}`}>
                  {getLegDescription(leg)}
                </p>
                <p className="text-xs text-slate-400">
                  {leg.duration}분
                  {leg.stationCount && ` · ${leg.stationCount}개 정류장`}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
