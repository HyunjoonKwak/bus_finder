import { createServiceClient } from '@/lib/supabase/service';
import { getBusArrival } from '@/lib/publicdata/bus-arrival';
import { timerManager } from './dynamic-timer';

const ARRIVAL_IMMINENT_THRESHOLD = 180; // 3분 이내면 "곧 도착" 상태
const DUPLICATE_PREVENTION_TIME = 3 * 60 * 1000; // 3분 내 중복 기록 방지

interface TrackingTarget {
  id: string;
  user_id: string;
  bus_id: string;
  bus_no: string;
  station_id: string;
  station_name: string;
  ars_id: string | null;
  is_active: boolean;
  next_check_at: string;
}

interface PendingArrival {
  id: string;
  user_id: string;
  bus_id: string;
  bus_no: string;
  station_id: string;
  station_name: string;
  ars_id: string | null;
  arrival_sec: number;
  updated_at: string;
}

/**
 * 스마트 간격 계산: 도착 예정시간 - 3분 = 다음 수집 시간
 */
function calculateNextCheckTime(arrivalSec: number | null): Date {
  const now = Date.now();

  if (arrivalSec === null || arrivalSec === undefined) {
    // 도착 정보 없음 → 5분 후 재확인
    return new Date(now + 5 * 60 * 1000);
  }

  if (arrivalSec <= ARRIVAL_IMMINENT_THRESHOLD) {
    // 3분 이내 → 1분 후 재확인 (도착 감지용)
    return new Date(now + 60 * 1000);
  }

  // 도착 예정시간 - 3분 = 다음 수집 시간
  // 예: 38분 후 도착 → 35분 후 재수집
  const nextCheckSec = Math.max(arrivalSec - ARRIVAL_IMMINENT_THRESHOLD, 60);
  return new Date(now + nextCheckSec * 1000);
}

/**
 * 서버 Cron에서 호출되는 메인 수집 함수
 */
export async function collectArrivals(): Promise<{
  checked: number;
  logged: number;
  errors: string[];
}> {
  const supabase = createServiceClient();
  const now = new Date();
  const errors: string[] = [];
  let checked = 0;
  let logged = 0;

  try {
    // 1. next_check_at <= NOW() 인 활성 추적 대상 조회
    const { data: targets, error: targetsError } = await supabase
      .from('bus_tracking_targets')
      .select('*')
      .eq('is_active', true)
      .lte('next_check_at', now.toISOString());

    if (targetsError) {
      errors.push(`Failed to fetch targets: ${targetsError.message}`);
      return { checked, logged, errors };
    }

    if (!targets || targets.length === 0) {
      console.log('[Cron] No targets to check');
      return { checked, logged, errors };
    }

    console.log(`[Cron] Checking ${targets.length} targets`);

    // 2. 정류소별 그룹화 (API 호출 최소화)
    const stationMap = new Map<string, TrackingTarget[]>();
    for (const target of targets as TrackingTarget[]) {
      const key = `${target.station_id}|${target.ars_id || ''}`;
      const existing = stationMap.get(key) || [];
      existing.push(target);
      stationMap.set(key, existing);
    }

    // 3. 정류소별로 도착 정보 조회
    for (const [stationKey, stationTargets] of stationMap) {
      try {
        const [stationId, arsId] = stationKey.split('|');

        // 도착 정보 조회 (공공데이터 API)
        const arrivals = await getBusArrival(stationId, arsId || undefined);
        checked += stationTargets.length;

        for (const target of stationTargets) {
          try {
            // 버스 매칭
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

            const arrivalSec = busArrival?.predictTime1
              ? busArrival.predictTime1 * 60
              : null;
            const plateNo = busArrival?.plateNo1 || null;

            // 4. 다음 수집 시간 계산 및 업데이트
            const nextCheckAt = calculateNextCheckTime(arrivalSec);
            await supabase
              .from('bus_tracking_targets')
              .update({ next_check_at: nextCheckAt.toISOString() })
              .eq('id', target.id);

            // 5. 도착 감지 로직
            const logResult = await handleArrivalDetection(
              supabase,
              target,
              arrivalSec,
              now,
              plateNo
            );
            if (logResult) logged++;

            // 로그 출력
            if (arrivalSec !== null) {
              const minutes = Math.floor(arrivalSec / 60);
              const nextMinutes = Math.floor((nextCheckAt.getTime() - now.getTime()) / 60000);
              console.log(
                `[Cron] ${target.bus_no} @ ${target.station_name}: ` +
                `${minutes}분 남음, 다음 체크 ${nextMinutes}분 후`
              );
            } else {
              console.log(
                `[Cron] ${target.bus_no} @ ${target.station_name}: 정보 없음, 5분 후 재확인`
              );
            }
          } catch (targetError) {
            const errMsg = targetError instanceof Error ? targetError.message : String(targetError);
            errors.push(`Target ${target.bus_no}: ${errMsg}`);
          }
        }
      } catch (stationError) {
        const errMsg = stationError instanceof Error ? stationError.message : String(stationError);
        errors.push(`Station ${stationKey}: ${errMsg}`);
      }
    }

    console.log(`[Cron] Complete: ${checked} checked, ${logged} logged`);
    return { checked, logged, errors };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    errors.push(`Collection error: ${errMsg}`);
    return { checked, logged, errors };
  }
}

/**
 * 동적 타이머 방식: 전체 추적 대상 스캔 후 타이머 설정
 * 메인 타이머(15분)에서 호출
 */
export async function scanAndSetupTimers(): Promise<{
  checked: number;
  timersSet: number;
  errors: string[];
}> {
  const supabase = createServiceClient();
  const errors: string[] = [];
  let checked = 0;
  let timersSet = 0;

  try {
    // 1. 모든 활성 추적 대상 조회 (next_check_at 무시)
    const { data: targets, error: targetsError } = await supabase
      .from('bus_tracking_targets')
      .select('*')
      .eq('is_active', true);

    if (targetsError) {
      errors.push(`Failed to fetch targets: ${targetsError.message}`);
      return { checked, timersSet, errors };
    }

    if (!targets || targets.length === 0) {
      console.log('[Scan] No active targets');
      return { checked, timersSet, errors };
    }

    console.log(`[Scan] Scanning ${targets.length} active targets`);

    // 2. 정류소별 그룹화 (API 호출 최소화)
    const stationMap = new Map<string, TrackingTarget[]>();
    for (const target of targets as TrackingTarget[]) {
      const key = `${target.station_id}|${target.ars_id || ''}`;
      const existing = stationMap.get(key) || [];
      existing.push(target);
      stationMap.set(key, existing);
    }

    // 3. 정류소별로 도착 정보 조회 및 타이머 설정
    for (const [stationKey, stationTargets] of stationMap) {
      try {
        const [stationId, arsId] = stationKey.split('|');

        // 도착 정보 조회 (공공데이터 API)
        const arrivals = await getBusArrival(stationId, arsId || undefined);
        checked += stationTargets.length;

        for (const target of stationTargets) {
          try {
            // 버스 매칭
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

            const arrivalSec = busArrival?.predictTime1
              ? busArrival.predictTime1 * 60
              : null;

            // 동적 타이머 설정
            timerManager.setTimer(target, arrivalSec);
            timersSet++;

          } catch (targetError) {
            const errMsg = targetError instanceof Error ? targetError.message : String(targetError);
            errors.push(`Target ${target.bus_no}: ${errMsg}`);
          }
        }
      } catch (stationError) {
        const errMsg = stationError instanceof Error ? stationError.message : String(stationError);
        errors.push(`Station ${stationKey}: ${errMsg}`);
      }
    }

    console.log(`[Scan] Complete: ${checked} checked, ${timersSet} timers set`);
    return { checked, timersSet, errors };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    errors.push(`Scan error: ${errMsg}`);
    return { checked, timersSet, errors };
  }
}

/**
 * 도착 감지 및 기록 처리
 */
async function handleArrivalDetection(
  supabase: ReturnType<typeof createServiceClient>,
  target: TrackingTarget,
  arrivalSec: number | null,
  now: Date,
  plateNo: string | null
): Promise<boolean> {
  const logKey = {
    user_id: target.user_id,
    bus_id: target.bus_id,
    station_id: target.station_id
  };

  // 기존 pending 상태 조회
  const { data: pending } = await supabase
    .from('pending_arrivals')
    .select('*')
    .eq('user_id', target.user_id)
    .eq('bus_id', target.bus_id)
    .eq('station_id', target.station_id)
    .single();

  // Case 1: 3분 이내 도착 예정
  if (arrivalSec !== null && arrivalSec <= ARRIVAL_IMMINENT_THRESHOLD) {
    // pending에 추가/업데이트
    await supabase
      .from('pending_arrivals')
      .upsert({
        ...logKey,
        bus_no: target.bus_no,
        station_name: target.station_name,
        ars_id: target.ars_id,
        arrival_sec: arrivalSec,
        plate_no: plateNo,
        updated_at: now.toISOString(),
      }, {
        onConflict: 'user_id,bus_id,station_id',
      });

    if (!pending) {
      console.log(`[Cron] ${target.bus_no}: 곧 도착 상태 시작 (${arrivalSec}초) [${plateNo || '번호없음'}]`);
    }
    return false;
  }

  // Case 2: 이전에 곧 도착 상태였는데 이제 3분 초과 또는 정보 없음 → 도착 기록
  if (pending) {
    const pendingData = pending as PendingArrival;

    // 도착 판정: 이전에 3분 이내였는데 이제 3분 초과이거나 정보 없음
    // - arrivalSec === null: 정보 없음 (버스가 지나감)
    // - arrivalSec > ARRIVAL_IMMINENT_THRESHOLD: 다음 버스로 변경됨
    // 두 경우 모두 이전 버스가 도착한 것으로 판단

    console.log(`[Cron] ${target.bus_no}: pending 상태에서 변경 감지 (이전: ${pendingData.arrival_sec}초, 현재: ${arrivalSec === null ? '정보없음' : arrivalSec + '초'})`);

    // 중복 방지: 최근 3분 내 동일 버스/정류소 기록이 있는지 확인
    const recentCutoff = new Date(now.getTime() - DUPLICATE_PREVENTION_TIME);
    const { data: recentLogs } = await supabase
      .from('bus_arrival_logs')
      .select('id')
      .eq('user_id', target.user_id)
      .eq('bus_id', target.bus_id)
      .eq('station_id', target.station_id)
      .gte('arrival_time', recentCutoff.toISOString())
      .limit(1);

    if (recentLogs && recentLogs.length > 0) {
      console.log(`[Cron] ${target.bus_no}: 3분 내 중복 기록 방지 - 스킵`);
      // pending 삭제만 하고 기록은 안 함
      await supabase
        .from('pending_arrivals')
        .delete()
        .eq('user_id', target.user_id)
        .eq('bus_id', target.bus_id)
        .eq('station_id', target.station_id);
      return false;
    }

    // 도착 기록
    const dayOfWeek = now.getDay(); // 0=일, 1=월, ..., 6=토
    const pendingPlateNo = (pendingData as PendingArrival & { plate_no?: string }).plate_no || null;
    const { error: logError } = await supabase
      .from('bus_arrival_logs')
      .insert({
        user_id: target.user_id,
        bus_id: target.bus_id,
        bus_no: target.bus_no,
        station_id: target.station_id,
        station_name: target.station_name,
        arrival_time: now.toISOString(),
        day_of_week: dayOfWeek,
        plate_no: pendingPlateNo,
      });

    if (logError) {
      console.error(`[Cron] Log error: ${logError.message}`);
      return false;
    }

    // pending에서 삭제
    await supabase
      .from('pending_arrivals')
      .delete()
      .eq('user_id', target.user_id)
      .eq('bus_id', target.bus_id)
      .eq('station_id', target.station_id);

    console.log(`[Cron] 도착 기록: ${target.bus_no} @ ${target.station_name}`);
    return true;
  }

  return false;
}
