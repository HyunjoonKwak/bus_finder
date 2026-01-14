'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[App] Service Worker registered:', registration.scope);

          // Periodic Background Sync 등록 시도 (지원되는 브라우저에서만)
          if ('periodicSync' in registration) {
            navigator.permissions
              .query({ name: 'periodic-background-sync' as PermissionName })
              .then((status) => {
                if (status.state === 'granted') {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (registration as any).periodicSync.register('collect-arrivals', {
                    minInterval: 5 * 60 * 1000, // 5분
                  });
                  console.log('[App] Periodic sync registered');
                }
              })
              .catch((err) => {
                console.log('[App] Periodic sync not available:', err);
              });
          }
        })
        .catch((error) => {
          console.error('[App] Service Worker registration failed:', error);
        });

      // Service Worker 메시지 수신
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, data } = event.data;

        switch (type) {
          case 'COLLECTION_STARTED':
            console.log('[App] Background collection started');
            break;
          case 'COLLECTION_STOPPED':
            console.log('[App] Background collection stopped');
            break;
          case 'ARRIVALS_COLLECTED':
            console.log('[App] Arrivals collected:', data);
            // 필요시 알림 표시
            if (data.logs && data.logs.length > 0) {
              showNotification(data.logs);
            }
            break;
        }
      });
    }
  }, []);

  return null;
}

async function showNotification(logs: Array<{ bus_no: string; station_name: string }>) {
  if ('Notification' in window && Notification.permission === 'granted') {
    const message = logs
      .map((log) => `${log.bus_no}번 @ ${log.station_name}`)
      .join('\n');

    new Notification('버스 도착 기록됨', {
      body: message,
      icon: '/icons/icon-192x192.png',
    });
  }
}
