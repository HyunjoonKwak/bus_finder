'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

interface CommuteRoute {
  id: string;
  name: string;
  origin_name: string;
  origin_x: string;
  origin_y: string;
  dest_name: string;
  dest_x: string;
  dest_y: string;
  is_active: boolean;
  created_at: string;
}

export default function CommutePage() {
  const router = useRouter();
  const [routes, setRoutes] = useState<CommuteRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    origin_name: '',
    dest_name: '',
  });

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      const response = await fetch('/api/commute');
      const data = await response.json();
      setRoutes(data.routes || []);
    } catch (error) {
      console.error('Fetch routes error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!formData.name || !formData.origin_name || !formData.dest_name) {
      alert('모든 필드를 입력해주세요.');
      return;
    }

    try {
      const response = await fetch('/api/commute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setFormData({ name: '', origin_name: '', dest_name: '' });
        setShowForm(false);
        fetchRoutes();
      }
    } catch (error) {
      console.error('Add route error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 출퇴근 경로를 삭제하시겠습니까?')) return;

    try {
      await fetch(`/api/commute?id=${id}`, { method: 'DELETE' });
      fetchRoutes();
    } catch (error) {
      console.error('Delete route error:', error);
    }
  };

  const handleSearch = (route: CommuteRoute) => {
    const params = new URLSearchParams({
      sx: route.origin_x || '',
      sy: route.origin_y || '',
      ex: route.dest_x || '',
      ey: route.dest_y || '',
      sname: route.origin_name,
      ename: route.dest_name,
    });
    router.push(`/search?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-slate-900 mb-4">출퇴근 모드</h1>
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">출퇴근 모드</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? '취소' : '+ 추가'}
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 mb-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                경로 이름
              </label>
              <Input
                placeholder="예: 출근길"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                출발지
              </label>
              <Input
                placeholder="예: 집"
                value={formData.origin_name}
                onChange={(e) =>
                  setFormData({ ...formData, origin_name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                도착지
              </label>
              <Input
                placeholder="예: 회사"
                value={formData.dest_name}
                onChange={(e) =>
                  setFormData({ ...formData, dest_name: e.target.value })
                }
              />
            </div>
            <Button className="w-full" onClick={handleAdd}>
              저장
            </Button>
          </div>
        </Card>
      )}

      {routes.length === 0 ? (
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
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-slate-500 mb-2">등록된 출퇴근 경로가 없습니다.</p>
          <p className="text-sm text-slate-400">
            자주 이용하는 경로를 등록해보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {routes.map((route) => (
            <Card key={route.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900">{route.name}</h3>
                  <div className="mt-2 flex items-center text-sm text-slate-600">
                    <span className="flex items-center">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                      {route.origin_name}
                    </span>
                    <svg
                      className="w-4 h-4 mx-2 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14 5l7 7m0 0l-7 7m7-7H3"
                      />
                    </svg>
                    <span className="flex items-center">
                      <span className="w-2 h-2 rounded-full bg-red-500 mr-2" />
                      {route.dest_name}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(route.id)}
                  className="text-slate-400 hover:text-red-500 p-1"
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
              <div className="mt-3 flex gap-2">
                <Button
                  className="flex-1"
                  size="sm"
                  onClick={() => handleSearch(route)}
                >
                  경로 검색
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    // 역방향 검색
                    handleSearch({
                      ...route,
                      origin_name: route.dest_name,
                      origin_x: route.dest_x,
                      origin_y: route.dest_y,
                      dest_name: route.origin_name,
                      dest_x: route.origin_x,
                      dest_y: route.origin_y,
                    });
                  }}
                >
                  역방향
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
