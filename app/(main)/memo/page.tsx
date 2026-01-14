'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { createClient } from '@/lib/supabase/client';

interface Memo {
  id: string;
  route_id: string;
  route_name: string;
  content: string;
  created_at: string;
}

export default function MemoPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [newMemo, setNewMemo] = useState({ routeName: '', content: '' });
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // 사용자 확인
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchMemos();
      } else {
        setLoading(false);
      }
    });
  }, []);

  const fetchMemos = async () => {
    try {
      const response = await fetch('/api/memo');
      const data = await response.json();

      if (response.ok) {
        setMemos(data.memos || []);
      }
    } catch (err) {
      console.error('메모 조회 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newMemo.routeName || !newMemo.content) return;

    setSaving(true);
    try {
      const response = await fetch('/api/memo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          route_id: newMemo.routeName.replace(/\s/g, '-').toLowerCase(),
          route_name: newMemo.routeName,
          content: newMemo.content,
        }),
      });

      if (response.ok) {
        setIsOpen(false);
        setNewMemo({ routeName: '', content: '' });
        fetchMemos(); // 목록 새로고침
      }
    } catch (err) {
      console.error('메모 저장 오류:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 메모를 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/memo?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMemos(memos.filter((m) => m.id !== id));
      }
    } catch (err) {
      console.error('메모 삭제 오류:', err);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!user && !loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <p className="text-slate-500 mb-4">로그인이 필요한 기능입니다.</p>
        <Button
          onClick={() => window.location.href = '/login'}
          className="bg-emerald-500 hover:bg-emerald-600"
        >
          로그인하기
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-4">
        <div className="flex items-center justify-between mb-4">
          <div className="h-7 w-24 bg-slate-200 rounded animate-pulse" />
          <div className="h-9 w-24 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="p-4 animate-pulse">
              <div className="h-5 w-32 bg-slate-200 rounded mb-2" />
              <div className="h-4 w-full bg-slate-200 rounded" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-slate-900">노선 메모</h1>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600">
              + 메모 추가
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[50vh]">
            <SheetHeader>
              <SheetTitle>새 메모 작성</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4">
              <Input
                placeholder="노선명 또는 정류장명"
                value={newMemo.routeName}
                onChange={(e) =>
                  setNewMemo({ ...newMemo, routeName: e.target.value })
                }
              />
              <textarea
                className="w-full h-32 p-3 border border-slate-200 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="메모 내용을 입력하세요"
                value={newMemo.content}
                onChange={(e) =>
                  setNewMemo({ ...newMemo, content: e.target.value })
                }
              />
              <Button
                onClick={handleSubmit}
                className="w-full bg-emerald-500 hover:bg-emerald-600"
                disabled={!newMemo.routeName || !newMemo.content || saving}
              >
                {saving ? '저장 중...' : '저장'}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {memos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-slate-500">아직 작성한 메모가 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {memos.map((memo) => (
            <Card key={memo.id} className="p-4">
              <div className="flex items-start justify-between mb-2">
                <span className="font-medium text-slate-900">
                  {memo.route_name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {formatDate(memo.created_at)}
                  </span>
                  <button
                    onClick={() => handleDelete(memo.id)}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    삭제
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-600 whitespace-pre-wrap">
                {memo.content}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
