// Service Worker for 버스타볼까
const CACHE_NAME = 'bus-finder-v1';
const COLLECTION_INTERVAL = 5 * 60 * 1000; // 5분 간격
const AUTO_LOG_THRESHOLD = 90; // 1분 30초 이내면 자동 기록

let collectionTimer = null;
let isCollecting = false;

// Install event
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(clients.claim());
});

// Message handler from main thread
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'START_COLLECTION':
      startCollection();
      break;
    case 'STOP_COLLECTION':
      stopCollection();
      break;
    case 'GET_STATUS':
      event.ports[0].postMessage({
        isCollecting: collectionTimer !== null,
      });
      break;
  }
});

// Start periodic collection
function startCollection() {
  if (collectionTimer) {
    console.log('[SW] Collection already running');
    return;
  }

  console.log('[SW] Starting periodic collection...');

  // 즉시 한 번 실행
  collectArrivals();

  // 5분마다 반복
  collectionTimer = setInterval(() => {
    collectArrivals();
  }, COLLECTION_INTERVAL);

  // 모든 클라이언트에 상태 알림
  notifyClients({ type: 'COLLECTION_STARTED' });
}

// Stop periodic collection
function stopCollection() {
  if (collectionTimer) {
    clearInterval(collectionTimer);
    collectionTimer = null;
    console.log('[SW] Collection stopped');
    notifyClients({ type: 'COLLECTION_STOPPED' });
  }
}

// Collect arrivals
async function collectArrivals() {
  if (isCollecting) {
    console.log('[SW] Already collecting, skipping...');
    return;
  }

  isCollecting = true;
  console.log('[SW] Collecting arrivals at', new Date().toLocaleTimeString());

  try {
    // 수집 대상 목록 가져오기
    const targetsResponse = await fetch('/api/tracking/targets');
    if (!targetsResponse.ok) {
      throw new Error('Failed to fetch targets');
    }

    const targetsData = await targetsResponse.json();
    const activeTargets = (targetsData.targets || []).filter((t) => t.is_active);

    if (activeTargets.length === 0) {
      console.log('[SW] No active targets');
      isCollecting = false;
      return;
    }

    // 정류소별로 그룹화 (station_id + ars_id 조합)
    const stationMap = new Map();
    for (const target of activeTargets) {
      const key = `${target.station_id}|${target.ars_id || ''}`;
      const existing = stationMap.get(key) || [];
      existing.push(target);
      stationMap.set(key, existing);
    }

    const collectedLogs = [];

    // 각 정류소별로 도착 정보 확인 (공공데이터포털 API 사용)
    for (const [stationKey, stationTargets] of stationMap) {
      try {
        const [stationId, arsId] = stationKey.split('|');
        const params = new URLSearchParams({ stationId });
        if (arsId) params.append('arsId', arsId);

        const arrivalResponse = await fetch(`/api/bus/arrival?${params.toString()}`);
        if (!arrivalResponse.ok) continue;

        const arrivalData = await arrivalResponse.json();
        const arrivals = arrivalData.arrivals || [];

        for (const target of stationTargets) {
          // 버스 매칭 - routeId 또는 routeName으로 찾기
          const busArrival = arrivals.find((a) => {
            const aRouteId = String(a.routeId || '');
            const aRouteName = String(a.routeName || '');
            const tBusId = String(target.bus_id || '');
            const tBusNo = String(target.bus_no || '');
            return (
              aRouteId === tBusId ||
              aRouteName === tBusNo ||
              aRouteName.replace(/\s/g, '') === tBusNo.replace(/\s/g, '')
            );
          });

          // 도착 임박 시 자동 기록 (predictTime1이 분 단위, AUTO_LOG_THRESHOLD는 초 단위)
          const arrivalSec = busArrival?.predictTime1 ? busArrival.predictTime1 * 60 : null;
          if (arrivalSec !== null && arrivalSec <= AUTO_LOG_THRESHOLD) {
            try {
              // 예상 도착 시간 계산
              const arrivalTime = new Date(Date.now() + arrivalSec * 1000).toISOString();

              const logResponse = await fetch('/api/tracking/logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  bus_id: target.bus_id,
                  bus_no: target.bus_no,
                  station_id: target.station_id,
                  station_name: target.station_name,
                  arrival_time: arrivalTime,
                }),
              });

              if (logResponse.ok) {
                collectedLogs.push({
                  bus_no: target.bus_no,
                  station_name: target.station_name,
                  arrivalSec: arrivalSec,
                });
                console.log(`[SW] Logged: ${target.bus_no} @ ${target.station_name} (${arrivalSec}초)`);
              }
            } catch (logError) {
              console.error('[SW] Log error:', logError);
            }
          }
        }
      } catch (stationError) {
        console.error(`[SW] Station error:`, stationError);
      }
    }

    // 수집 결과 알림
    if (collectedLogs.length > 0) {
      notifyClients({
        type: 'ARRIVALS_COLLECTED',
        data: { logs: collectedLogs, timestamp: new Date().toISOString() },
      });
    }

    console.log(`[SW] Collection complete. Logged ${collectedLogs.length} arrivals.`);
  } catch (error) {
    console.error('[SW] Collection error:', error);
  } finally {
    isCollecting = false;
  }
}

// Notify all clients
async function notifyClients(message) {
  const allClients = await clients.matchAll({ type: 'window' });
  for (const client of allClients) {
    client.postMessage(message);
  }
}

// Periodic Sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'collect-arrivals') {
    event.waitUntil(collectArrivals());
  }
});

// Background Sync (fallback)
self.addEventListener('sync', (event) => {
  if (event.tag === 'collect-arrivals') {
    event.waitUntil(collectArrivals());
  }
});
