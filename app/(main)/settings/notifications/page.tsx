'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface NotificationSetting {
  id: string;
  notification_type: string;
  target_id: string;
  target_name: string;
  minutes_before: number;
  webhook_type: string;
  webhook_url: string;
  is_enabled: boolean;
  created_at: string;
}

export default function NotificationSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<NotificationSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [testing, setTesting] = useState(false);

  const [formData, setFormData] = useState({
    notification_type: 'bus_arrival',
    target_name: '',
    minutes_before: 5,
    webhook_type: 'discord',
    webhook_url: '',
    bot_token: '',
    chat_id: '',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/notifications/settings');
      const data = await response.json();
      setSettings(data.settings || []);
    } catch (error) {
      console.error('Fetch settings error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    const webhookUrl =
      formData.webhook_type === 'telegram'
        ? `telegram:${formData.bot_token}:${formData.chat_id}`
        : formData.webhook_url;

    if (!webhookUrl || webhookUrl === 'telegram::') {
      alert('웹훅 정보를 입력해주세요.');
      return;
    }

    try {
      const response = await fetch('/api/notifications/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          notification_type: formData.notification_type,
          target_name: formData.target_name || '전체',
          minutes_before: formData.minutes_before,
          webhook_type: formData.webhook_type,
          webhook_url: webhookUrl,
        }),
      });

      if (response.ok) {
        setFormData({
          notification_type: 'bus_arrival',
          target_name: '',
          minutes_before: 5,
          webhook_type: 'discord',
          webhook_url: '',
          bot_token: '',
          chat_id: '',
        });
        setShowForm(false);
        fetchSettings();
      }
    } catch (error) {
      console.error('Add setting error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 알림 설정을 삭제하시겠습니까?')) return;

    try {
      await fetch(`/api/notifications/settings?id=${id}`, { method: 'DELETE' });
      fetchSettings();
    } catch (error) {
      console.error('Delete setting error:', error);
    }
  };

  const handleToggle = async (setting: NotificationSetting) => {
    try {
      await fetch('/api/notifications/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: setting.id, is_enabled: !setting.is_enabled }),
      });
      fetchSettings();
    } catch (error) {
      console.error('Toggle setting error:', error);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhook_type: formData.webhook_type,
          webhook_url: formData.webhook_url,
          bot_token: formData.bot_token,
          chat_id: formData.chat_id,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        alert(data.message || '테스트 메시지가 전송되었습니다.');
      } else {
        alert(data.error || '테스트 전송에 실패했습니다.');
      }
    } catch (error) {
      console.error('Test error:', error);
      alert('테스트 전송 중 오류가 발생했습니다.');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-4">
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
      <button
        onClick={() => router.back()}
        className="flex items-center text-muted-foreground mb-4"
      >
        <svg
          className="w-5 h-5 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        돌아가기
      </button>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-foreground">알림 설정</h1>
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
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                알림 유형
              </label>
              <select
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                value={formData.notification_type}
                onChange={(e) =>
                  setFormData({ ...formData, notification_type: e.target.value })
                }
              >
                <option value="bus_arrival">버스 도착 알림</option>
                <option value="last_bus">막차 알림</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                알림 시점 (분 전)
              </label>
              <Input
                type="number"
                min={1}
                max={30}
                value={formData.minutes_before}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    minutes_before: parseInt(e.target.value) || 5,
                  })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                알림 방법
              </label>
              <div className="flex gap-2">
                <Button
                  variant={formData.webhook_type === 'discord' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormData({ ...formData, webhook_type: 'discord' })}
                >
                  Discord
                </Button>
                <Button
                  variant={formData.webhook_type === 'telegram' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFormData({ ...formData, webhook_type: 'telegram' })}
                >
                  Telegram
                </Button>
              </div>
            </div>

            {formData.webhook_type === 'discord' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Discord Webhook URL
                </label>
                <Input
                  placeholder="https://discord.com/api/webhooks/..."
                  value={formData.webhook_url}
                  onChange={(e) =>
                    setFormData({ ...formData, webhook_url: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  서버 설정 → 연동 → 웹후크에서 생성할 수 있습니다.
                </p>
              </div>
            )}

            {formData.webhook_type === 'telegram' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Bot Token
                  </label>
                  <Input
                    placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                    value={formData.bot_token}
                    onChange={(e) =>
                      setFormData({ ...formData, bot_token: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    @BotFather에서 봇을 생성하고 토큰을 받으세요.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Chat ID
                  </label>
                  <Input
                    placeholder="-1001234567890"
                    value={formData.chat_id}
                    onChange={(e) =>
                      setFormData({ ...formData, chat_id: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    @userinfobot에서 채팅 ID를 확인할 수 있습니다.
                  </p>
                </div>
              </>
            )}

            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleAdd}>
                저장
              </Button>
              <Button
                variant="outline"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? '전송 중...' : '테스트'}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {settings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg
            className="w-16 h-16 text-muted-foreground/50 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          <p className="text-muted-foreground mb-2">등록된 알림 설정이 없습니다.</p>
          <p className="text-sm text-muted-foreground/70">
            Discord나 Telegram으로 버스 도착 알림을 받아보세요.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {settings.map((setting) => (
            <Card key={setting.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={setting.is_enabled ? 'default' : 'secondary'}>
                      {setting.notification_type === 'bus_arrival'
                        ? '도착 알림'
                        : '막차 알림'}
                    </Badge>
                    <Badge variant="outline">
                      {setting.webhook_type === 'telegram' ? 'Telegram' : 'Discord'}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {setting.minutes_before}분 전 알림
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleToggle(setting)}
                    className={`p-2 rounded-full ${
                      setting.is_enabled
                        ? 'text-primary'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {setting.is_enabled ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(setting.id)}
                    className="p-2 text-muted-foreground hover:text-destructive"
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
