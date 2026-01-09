'use client';

import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';

export default function SettingsPage() {
  const router = useRouter();

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
      title: '출퇴근 경로',
      description: '자주 이용하는 출퇴근 경로 관리',
      href: '/commute',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
      <h1 className="text-xl font-bold text-slate-900 mb-4">설정</h1>

      <div className="space-y-3">
        {menuItems.map((item) => (
          <Card
            key={item.href}
            className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => router.push(item.href)}
          >
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0 w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                {item.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-slate-900">{item.title}</h3>
                <p className="text-sm text-slate-500">{item.description}</p>
              </div>
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
