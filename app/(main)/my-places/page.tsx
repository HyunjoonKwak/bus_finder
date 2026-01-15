'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlaceSearchInput } from '@/components/search/PlaceSearchInput';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

interface MyPlace {
  id: string;
  name: string;
  place_name: string;
  address: string | null;
  x: string;
  y: string;
  icon: 'home' | 'office' | 'pin';
  sort_order: number;
}

const ICON_OPTIONS = [
  { value: 'home', label: '집', emoji: '🏠' },
  { value: 'office', label: '회사', emoji: '🏢' },
  { value: 'pin', label: '기타', emoji: '📍' },
];

export default function MyPlacesPage() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState<MyPlace[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    place_name: '',
    address: '',
    x: '',
    y: '',
    icon: 'pin' as 'home' | 'office' | 'pin',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user) {
        fetchPlaces();
      } else {
        setLoading(false);
      }
    });
  }, []);

  const fetchPlaces = async () => {
    try {
      const res = await fetch('/api/my-places');
      const data = await res.json();
      setPlaces(data.places || []);
    } catch (error) {
      console.error('Fetch places error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlaceSelect = (place: { name: string; x: string; y: string; roadAddress?: string; address?: string }) => {
    setFormData({
      ...formData,
      place_name: place.name,
      address: place.roadAddress || place.address || '',
      x: place.x,
      y: place.y,
    });
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.place_name || !formData.x || !formData.y) {
      alert('이름과 장소를 모두 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      const url = editingId ? `/api/my-places/${editingId}` : '/api/my-places';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        resetForm();
        fetchPlaces();
      } else {
        const data = await res.json();
        console.error('Save error response:', data);
        alert(data.error + (data.detail ? `\n(${data.detail})` : '') || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (place: MyPlace) => {
    setEditingId(place.id);
    setFormData({
      name: place.name,
      place_name: place.place_name,
      address: place.address || '',
      x: place.x,
      y: place.y,
      icon: place.icon,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 장소를 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`/api/my-places/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchPlaces();
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData({
      name: '',
      place_name: '',
      address: '',
      x: '',
      y: '',
      icon: 'pin',
    });
  };

  const getIconEmoji = (icon: string) => {
    return ICON_OPTIONS.find((o) => o.value === icon)?.emoji || '📍';
  };

  if (!user && !loading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto py-16 text-center">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🏠</span>
          </div>
          <h1 className="text-lg font-semibold mb-2">내 장소</h1>
          <p className="text-sm text-muted-foreground mb-4">
            로그인하면 자주 가는 장소를 저장하고<br />빠르게 길찾기할 수 있어요.
          </p>
          <Link href="/login">
            <Button>로그인</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center gap-3 p-3">
          <button onClick={() => router.back()} className="p-2 hover:bg-accent rounded-full">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold">내 장소</h1>
          <span className="text-sm text-muted-foreground">({places.length}/5)</span>
        </div>
      </div>

      <div className="p-4 max-w-md mx-auto">
        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* 장소 목록 */}
            <div className="space-y-2 mb-4">
              {places.map((place) => (
                <Card key={place.id} className="p-3 border-border/50">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getIconEmoji(place.icon)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{place.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{place.place_name}</p>
                      {place.address && (
                        <p className="text-xs text-muted-foreground/70 truncate">{place.address}</p>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(place)}
                        className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(place.id)}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {/* 추가 버튼 또는 폼 */}
            {!showForm ? (
              places.length < 5 && (
                <Button
                  variant="outline"
                  className="w-full border-dashed"
                  onClick={() => setShowForm(true)}
                >
                  + 장소 추가
                </Button>
              )
            ) : (
              <Card className="p-4 border-border/50">
                <h2 className="font-semibold mb-3">{editingId ? '장소 수정' : '새 장소 추가'}</h2>

                <div className="space-y-3">
                  {/* 아이콘 선택 */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">아이콘</label>
                    <div className="flex gap-2">
                      {ICON_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setFormData({ ...formData, icon: option.value as 'home' | 'office' | 'pin' })}
                          className={`flex-1 p-2 rounded-lg border text-center transition-colors ${
                            formData.icon === option.value
                              ? 'border-primary bg-primary/10'
                              : 'border-border hover:bg-accent'
                          }`}
                        >
                          <span className="text-xl block mb-0.5">{option.emoji}</span>
                          <span className="text-xs">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 이름 */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">이름</label>
                    <Input
                      placeholder="예: 집, 회사, 학교"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  {/* 장소 검색 */}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">장소</label>
                    <PlaceSearchInput
                      value={formData.place_name}
                      onChange={(value) => setFormData({ ...formData, place_name: value, x: '', y: '' })}
                      onSelect={handlePlaceSelect}
                      placeholder="장소를 검색하세요"
                    />
                    {formData.x && formData.y && (
                      <p className="text-xs text-green-600 mt-1">✓ 위치가 선택되었습니다</p>
                    )}
                  </div>

                  {/* 버튼 */}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1" onClick={resetForm}>
                      취소
                    </Button>
                    <Button className="flex-1" onClick={handleSubmit} disabled={saving}>
                      {saving ? '저장 중...' : editingId ? '수정' : '추가'}
                    </Button>
                  </div>
                </div>
              </Card>
            )}

            {places.length >= 5 && !showForm && (
              <p className="text-center text-xs text-muted-foreground mt-4">
                최대 5개까지 등록할 수 있습니다
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
