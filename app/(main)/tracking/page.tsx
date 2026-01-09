'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TrackingTarget {
  id: string;
  bus_id: string;
  bus_no: string;
  station_id: string;
  station_name: string;
  is_active: boolean;
  created_at: string;
}

export default function TrackingPage() {
  const router = useRouter();
  const [targets, setTargets] = useState<TrackingTarget[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTargets();
  }, []);

  const fetchTargets = async () => {
    try {
      const response = await fetch('/api/tracking/targets');
      const data = await response.json();
      setTargets(data.targets || []);
    } catch (error) {
      console.error('Fetch targets error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (target: TrackingTarget) => {
    try {
      await fetch('/api/tracking/targets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: target.id, is_active: !target.is_active }),
      });
      fetchTargets();
    } catch (error) {
      console.error('Toggle target error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 추적 대상을 삭제하시겠습니까?')) return;

    try {
      await fetch(`/api/tracking/targets?id=${id}`, { method: 'DELETE' });
      fetchTargets();
    } catch (error) {
      console.error('Delete target error:', error);
    }
  };

  const handleViewStats = (target: TrackingTarget) => {
    router.push(
      `/tracking/stats?bus_id=${target.bus_id}&station_id=${target.station_id}&bus_no=${encodeURIComponent(target.bus_no)}&station_name=${encodeURIComponent(target.station_name)}`
    );
  };

  const handleLogArrival = async (target: TrackingTarget) => {
    if (!confirm(`${target.bus_no} 버스가 ${target.station_name}에 도착했습니까?`)) return;

    try {
      const response = await fetch('/api/tracking/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bus_id: target.bus_id,
          bus_no: target.bus_no,
          station_id: target.station_id,
          station_name: target.station_name,
        }),
      });

      if (response.ok) {
        alert('도착 시간이 기록되었습니다.');
      }
    } catch (error) {
      console.error('Log arrival error:', error);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-slate-900 mb-4">버스 도착 추적</h1>
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">버스 도착 추적</h1>
      </div>

      <p className="text-sm text-slate-500 mb-4">
        특정 버스가 정류소에 도착하는 시간을 기록하여 패턴을 분석합니다.
        <br />
        정류소 상세 페이지에서 추적할 버스를 추가할 수 있습니다.
      </p>

      {targets.length === 0 ? (
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
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <p className="text-slate-500 mb-2">추적 중인 버스가 없습니다.</p>
          <p className="text-sm text-slate-400 mb-4">
            정류소 상세 페이지에서 버스를 추적 대상으로 추가하세요.
          </p>
          <Button onClick={() => router.push('/station/search')}>
            정류소 검색
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {targets.map((target) => (
            <Card key={target.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-emerald-600">
                      {target.bus_no}
                    </span>
                    <Badge variant={target.is_active ? 'default' : 'secondary'}>
                      {target.is_active ? '활성' : '비활성'}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    {target.station_name}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleToggle(target)}
                    className="p-2 text-slate-400 hover:text-slate-600"
                    title={target.is_active ? '비활성화' : '활성화'}
                  >
                    {target.is_active ? (
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(target.id)}
                    className="p-2 text-slate-400 hover:text-red-500"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleLogArrival(target)}
                >
                  도착 기록
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleViewStats(target)}
                >
                  통계 보기
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
