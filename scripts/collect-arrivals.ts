// 버스 도착 시간 수집 스크립트
// Docker 환경에서 cron으로 실행
//
// 사용법:
// npx tsx scripts/collect-arrivals.ts
//
// crontab 예시 (5분마다):
// 0,5,10,15,20,25,30,35,40,45,50,55 * * * * cd /app && npx tsx scripts/collect-arrivals.ts

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ODSAY_API_KEY = process.env.ODSAY_API_KEY!;

const AUTO_LOG_THRESHOLD = 90; // 1분 30초 이내면 자동 기록

interface TrackingTarget {
  id: string;
  user_id: string;
  bus_id: string;
  bus_no: string;
  station_id: string;
  station_name: string;
  is_active: boolean;
}

async function main() {
  console.log(`[${new Date().toISOString()}] Starting arrival collection...`);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  if (!ODSAY_API_KEY) {
    console.error('Missing ODSAY_API_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 모든 활성화된 수집 대상 가져오기
  const { data: targets, error: targetsError } = await supabase
    .from('bus_tracking_targets')
    .select('*')
    .eq('is_active', true);

  if (targetsError) {
    console.error('Failed to fetch targets:', targetsError);
    process.exit(1);
  }

  if (!targets || targets.length === 0) {
    console.log('No active tracking targets found');
    process.exit(0);
  }

  console.log(`Found ${targets.length} active targets`);

  // 정류소별로 그룹화
  const stationMap = new Map<string, TrackingTarget[]>();
  for (const target of targets) {
    const existing = stationMap.get(target.station_id) || [];
    existing.push(target);
    stationMap.set(target.station_id, existing);
  }

  let totalLogged = 0;

  // 각 정류소별로 도착 정보 확인
  for (const [stationId, stationTargets] of stationMap) {
    try {
      // ODSay API 호출
      const apiUrl = `https://api.odsay.com/v1/api/realtimeStation?lang=0&stationID=${stationId}&apiKey=${encodeURIComponent(ODSAY_API_KEY)}`;
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (data.error) {
        console.error(`ODSay API error for station ${stationId}:`, data.error);
        continue;
      }

      const arrivals = data.result?.real || [];

      for (const target of stationTargets) {
        // 버스 노선 찾기
        const busArrival = arrivals.find(
          (a: any) => a.routeID?.toString() === target.bus_id || a.routeNm === target.bus_no
        );

        if (!busArrival) continue;

        // 도착 시간 확인 (arrival1이 첫번째 버스)
        const arrivalSec = busArrival.arrival1?.arrivalSec;

        if (arrivalSec && arrivalSec <= AUTO_LOG_THRESHOLD) {
          // 최근 5분 내 같은 버스 기록이 있는지 확인 (중복 방지)
          const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

          const { data: recentLogs } = await supabase
            .from('bus_arrival_logs')
            .select('id')
            .eq('user_id', target.user_id)
            .eq('bus_id', target.bus_id)
            .eq('station_id', target.station_id)
            .gte('created_at', fiveMinutesAgo)
            .limit(1);

          if (recentLogs && recentLogs.length > 0) {
            console.log(`Skipping duplicate: ${target.bus_no} @ ${target.station_name}`);
            continue;
          }

          // 도착 기록 저장
          const now = new Date();
          const { error: insertError } = await supabase
            .from('bus_arrival_logs')
            .insert({
              user_id: target.user_id,
              bus_id: target.bus_id,
              bus_no: target.bus_no,
              station_id: target.station_id,
              station_name: target.station_name,
              arrival_time: now.toISOString(),
              day_of_week: now.getDay(),
            });

          if (insertError) {
            console.error(`Failed to log arrival:`, insertError);
          } else {
            console.log(`Logged: ${target.bus_no} @ ${target.station_name} (${arrivalSec}초 전)`);
            totalLogged++;
          }
        }
      }

      // API 호출 간격 유지 (rate limit 방지)
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Error processing station ${stationId}:`, error);
    }
  }

  console.log(`[${new Date().toISOString()}] Collection complete. Logged ${totalLogged} arrivals.`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
