'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

interface HistoryItem {
  id: string;
  origin_name: string;
  dest_name: string;
  boarded_at: string;
  total_time: number | null;
  route_data: any;
}

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('transport_history')
        .select('*')
        .eq('user_id', user.id)
        .order('boarded_at', { ascending: false });

      if (error) {
        console.error('Failed to fetch history:', error);
      } else {
        setHistory(data || []);
      }

      setLoading(false);
    };

    fetchHistory();
  }, []);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleClick = (item: HistoryItem) => {
    if (item.route_data) {
      sessionStorage.setItem('selectedRoute', JSON.stringify(item.route_data));
      router.push(`/routes/${item.id}`);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-4">
        <h1 className="text-xl font-bold text-slate-900 mb-4">탑승 기록</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-4 w-48 bg-slate-200 rounded mb-2" />
              <div className="h-3 w-32 bg-slate-200 rounded" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <h1 className="text-xl font-bold text-slate-900 mb-4">탑승 기록</h1>

      {history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-slate-500">아직 탑승 기록이 없습니다.</p>
          <p className="text-sm text-slate-400 mt-2">
            경로를 검색하고 탑승 시작을 눌러보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => (
            <Card
              key={item.id}
              className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
              onClick={() => handleClick(item)}
            >
              <div className="flex items-center text-sm mb-2">
                <span className="text-emerald-500 font-medium">
                  {item.origin_name}
                </span>
                <span className="mx-2 text-slate-400">→</span>
                <span className="text-red-500 font-medium">
                  {item.dest_name}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span>{formatDate(item.boarded_at)}</span>
                {item.total_time && <span>소요시간 {item.total_time}분</span>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
