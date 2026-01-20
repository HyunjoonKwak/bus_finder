'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface TimerDetail {
  targetId: string;
  busNo: string;
  stationName: string;
  phase: string;
  nextCheckAt: string;
  lastArrivalSec: number | null;
}

interface SchedulerStatus {
  isRunning: boolean;
  intervalMinutes: number;
  lastRun: string | null;
  lastResult: {
    arrivals: { checked: number; logged: number };
    lastBusAlerts: { checked: number; sent: number };
  } | null;
  activeTimers?: number;
  timerDetails?: TimerDetail[];
  dbSettings?: {
    enabled: boolean;
    intervalMinutes: number;
    startHour: number;
    endHour: number;
  } | null;
}

interface TrackingLimits {
  stations: { current: number; max: number; available: number; exceeded: boolean };
  targets: { current: number; max: number; available: number; exceeded: boolean };
}

interface ApiUsage {
  todayCount: number;
  weeklyTotal: number;
  dailyLimit: number;
}

export default function SettingsPage() {
  const router = useRouter();
  const [scheduler, setScheduler] = useState<SchedulerStatus | null>(null);
  const [limits, setLimits] = useState<TrackingLimits | null>(null);
  const [apiUsage, setApiUsage] = useState<ApiUsage | null>(null);
  const [loading, setLoading] = useState(false);
  const [intervalMinutes, setIntervalMinutes] = useState(5);
  const [startHour, setStartHour] = useState(5);
  const [endHour, setEndHour] = useState(24);

  const fetchSchedulerStatus = async () => {
    try {
      const res = await fetch('/api/cron/scheduler');
      if (res.ok) {
        const data = await res.json();
        setScheduler(data);
        // DB 설정이 있으면 DB 설정 우선, 없으면 메모리 상태 사용
        const interval = data.dbSettings?.intervalMinutes || data.intervalMinutes || 5;
        setIntervalMinutes(interval);
        setStartHour(data.dbSettings?.startHour ?? 5);
        setEndHour(data.dbSettings?.endHour ?? 24);
      }
    } catch (error) {
      console.error('Failed to fetch scheduler status:', error);
    }
  };

  const fetchLimits = async () => {
    try {
      const res = await fetch('/api/tracking/limits');
      if (res.ok) {
        const data = await res.json();
        setLimits(data.limits);
      }
    } catch (error) {
      console.error('Failed to fetch limits:', error);
    }
  };

  const fetchApiUsage = async () => {
    try {
      const res = await fetch('/api/tracking/api-usage');
      if (res.ok) {
        const data = await res.json();
        setApiUsage(data);
      }
    } catch (error) {
      console.error('Failed to fetch API usage:', error);
    }
  };

  useEffect(() => {
    fetchSchedulerStatus();
    fetchLimits();
    fetchApiUsage();
  }, []);

  const handleSchedulerAction = async (action: 'start' | 'stop' | 'run') => {
    setLoading(true);
    try {
      const res = await fetch('/api/cron/scheduler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, intervalMinutes, startHour, endHour }),
      });
      if (res.ok) {
        const data = await res.json();
        setScheduler(data);
      }
    } catch (error) {
      console.error('Scheduler action failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatLastRun = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const menuItems = [
    {
      title: '알림 설정',
      description: '버스 도착 알림을 텔레그램/디스코드로 받기',
      href: '/settings/notifications',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      title: '버스 도착 추적',
      description: '버스 도착 시간 수집 및 통계',
      href: '/tracking',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      title: '메모',
      description: '탑승 메모 관리',
      href: '/memo',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="px-4 py-4">
      <h1 className="text-xl font-bold text-foreground mb-4">설정</h1>

      {/* 자동 수집 스케줄러 */}
      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/10 rounded-full flex items-center justify-center text-green-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h3 className="font-medium text-foreground">자동 수집 스케줄러</h3>
              <p className="text-xs text-muted-foreground">
                앱을 열지 않아도 백그라운드에서 자동 수집
              </p>
            </div>
          </div>
          <div className={`px-2 py-1 rounded text-xs font-medium ${
            scheduler?.isRunning
              ? 'bg-green-500/20 text-green-600'
              : 'bg-muted text-muted-foreground'
          }`}>
            {scheduler?.isRunning ? '실행 중' : '중지됨'}
          </div>
        </div>

        {/* 간격 설정 */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-muted-foreground">수집 간격:</span>
          <select
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(parseInt(e.target.value))}
            disabled={scheduler?.isRunning}
            className="text-sm border rounded px-2 py-1 bg-background disabled:opacity-50"
          >
            <option value={1}>1분</option>
            <option value={3}>3분</option>
            <option value={5}>5분</option>
            <option value={10}>10분</option>
            <option value={15}>15분</option>
          </select>
        </div>

        {/* 운영 시간 설정 */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-sm text-muted-foreground">운영 시간:</span>
          <select
            value={startHour}
            onChange={(e) => setStartHour(parseInt(e.target.value))}
            disabled={scheduler?.isRunning}
            className="text-sm border rounded px-2 py-1 bg-background disabled:opacity-50"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>{i.toString().padStart(2, '0')}:00</option>
            ))}
          </select>
          <span className="text-sm text-muted-foreground">~</span>
          <select
            value={endHour}
            onChange={(e) => setEndHour(parseInt(e.target.value))}
            disabled={scheduler?.isRunning}
            className="text-sm border rounded px-2 py-1 bg-background disabled:opacity-50"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i + 1} value={i + 1}>{i + 1 === 24 ? '24:00' : (i + 1).toString().padStart(2, '0') + ':00'}</option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground">(API 절약)</span>
        </div>

        {/* 제어 버튼 */}
        <div className="flex gap-2 mb-3">
          {scheduler?.isRunning ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleSchedulerAction('stop')}
              disabled={loading}
              className="flex-1"
            >
              {loading ? '처리 중...' : '중지'}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => handleSchedulerAction('start')}
              disabled={loading}
              className="flex-1"
            >
              {loading ? '처리 중...' : '시작'}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSchedulerAction('run')}
            disabled={loading}
          >
            수동 실행
          </Button>
        </div>

        {/* 마지막 실행 정보 */}
        {scheduler?.lastRun && (
          <div className="text-xs text-muted-foreground border-t pt-2">
            <p>마지막 실행: {formatLastRun(scheduler.lastRun)}</p>
            {scheduler.lastResult && (
              <p className="mt-1">
                수집: {scheduler.lastResult.arrivals.logged}건 기록 /
                막차 알림: {scheduler.lastResult.lastBusAlerts.sent}건 발송
              </p>
            )}
          </div>
        )}

        {/* DB 동기화 상태 */}
        {scheduler?.dbSettings && (
          <div className="text-xs text-muted-foreground border-t pt-2 mt-2">
            <p className="flex items-center gap-1 flex-wrap">
              <span>💾 DB:</span>
              <span className={scheduler.dbSettings.enabled ? 'text-green-600' : ''}>
                {scheduler.dbSettings.enabled ? '활성화' : '비활성화'}
              </span>
              <span>| {scheduler.dbSettings.intervalMinutes}분 간격</span>
              <span>| {scheduler.dbSettings.startHour}:00~{scheduler.dbSettings.endHour}:00</span>
            </p>
          </div>
        )}

        {/* 활성 추적 대상 현황 */}
        {scheduler?.isRunning && typeof scheduler.activeTimers === 'number' && (
          <div className="border-t pt-2 mt-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-foreground flex items-center gap-1">
                <span>📡</span>
                <span>활성 추적: {scheduler.activeTimers}개</span>
              </p>
            </div>
            {scheduler.timerDetails && scheduler.timerDetails.length > 0 && (
              <div className="space-y-1.5">
                {scheduler.timerDetails.slice(0, 5).map((timer) => (
                  <div
                    key={timer.targetId}
                    className="text-xs flex items-center gap-2 px-2 py-1 bg-muted/50 rounded"
                  >
                    <span className={`w-2 h-2 rounded-full ${
                      timer.phase === 'imminent' ? 'bg-red-500' :
                      timer.phase === 'approaching' ? 'bg-amber-500' :
                      'bg-green-500'
                    }`} />
                    <span className="font-medium text-primary">{timer.busNo}</span>
                    <span className="text-muted-foreground truncate flex-1">@{timer.stationName}</span>
                    <span className="text-muted-foreground">
                      {timer.lastArrivalSec !== null
                        ? `${Math.floor(timer.lastArrivalSec / 60)}분`
                        : '-'}
                    </span>
                  </div>
                ))}
                {scheduler.timerDetails.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center">
                    +{scheduler.timerDetails.length - 5}개 더
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 추적 제한 및 API 사용량 */}
      <Card className="p-4 mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-foreground">추적 현황</h3>
            <p className="text-xs text-muted-foreground">추적 제한 및 API 사용량</p>
          </div>
        </div>

        {/* 추적 제한 */}
        {limits && (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">정류소</p>
              <p className="text-lg font-bold text-foreground">
                {limits.stations.current}
                <span className="text-sm font-normal text-muted-foreground">/{limits.stations.max}</span>
              </p>
              <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                <div
                  className={`h-1.5 rounded-full ${limits.stations.exceeded ? 'bg-red-500' : 'bg-primary'}`}
                  style={{ width: `${(limits.stations.current / limits.stations.max) * 100}%` }}
                />
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">추적 대상</p>
              <p className="text-lg font-bold text-foreground">
                {limits.targets.current}
                <span className="text-sm font-normal text-muted-foreground">/{limits.targets.max}</span>
              </p>
              <div className="w-full bg-muted rounded-full h-1.5 mt-2">
                <div
                  className={`h-1.5 rounded-full ${limits.targets.exceeded ? 'bg-red-500' : 'bg-primary'}`}
                  style={{ width: `${(limits.targets.current / limits.targets.max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* API 사용량 */}
        {apiUsage && (
          <div className="border-t pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-muted-foreground">오늘 API 호출</p>
              <p className="text-sm font-medium">
                {apiUsage.todayCount.toLocaleString()}
                <span className="text-muted-foreground">/{apiUsage.dailyLimit.toLocaleString()}</span>
              </p>
            </div>
            <div className="w-full bg-muted rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${apiUsage.todayCount > apiUsage.dailyLimit * 0.8 ? 'bg-amber-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min((apiUsage.todayCount / apiUsage.dailyLimit) * 100, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              주간 합계: {apiUsage.weeklyTotal.toLocaleString()}회
            </p>
          </div>
        )}
      </Card>

      <h2 className="text-sm font-medium text-muted-foreground mb-2">메뉴</h2>
      <div className="space-y-3">
        {menuItems.map((item) => (
          <Card
            key={item.href}
            className="p-4 cursor-pointer hover:bg-accent transition-colors"
            onClick={() => router.push(item.href)}
          >
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                {item.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-foreground">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
