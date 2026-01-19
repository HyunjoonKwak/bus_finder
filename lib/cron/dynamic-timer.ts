import { createServiceClient } from '@/lib/supabase/service';
import { getBusArrival } from '@/lib/publicdata/bus-arrival';

const IMMINENT_THRESHOLD = 180; // 3분 이내 = 곧 도착
const APPROACH_THRESHOLD = 600; // 10분 이내 = 접근 중
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

interface TimerState {
  targetId: string;
  target: TrackingTarget;
  timer: NodeJS.Timeout | null;
  nextCheckAt: Date;
  phase: 'waiting' | 'approaching' | 'imminent';
  lastArrivalSec: number | null;
  lastPlateNo: string | null; // 마지막으로 감지한 차량번호
}

/**
 * 동적 타이머 매니저
 * - 각 추적 대상별로 개별 타이머 관리
 * - 도착 예정 시간에 맞춰 정확한 시점에 체크
 */
class DynamicTimerManager {
  private timers: Map<string, TimerState> = new Map();
  private initialized = false;

  /**
   * 타이머 설정
   */
  setTimer(target: TrackingTarget, arrivalSec: number | null, plateNo?: string | null): void {
    const existingTimer = this.timers.get(target.id);

    // 기존 타이머 해제
    if (existingTimer?.timer) {
      clearTimeout(existingTimer.timer);
    }

    // 도착 정보 없으면 타이머 해제 상태로 유지
    if (arrivalSec === null || arrivalSec === undefined) {
      // 이전에 imminent 상태(3분 이내)였으면 도착으로 처리
      if (existingTimer?.lastArrivalSec !== null &&
          existingTimer?.lastArrivalSec !== undefined &&
          existingTimer.lastArrivalSec <= IMMINENT_THRESHOLD) {
        const plateNoForLog = existingTimer.lastPlateNo;
        this.logArrival(target, new Date(), plateNoForLog).catch(err => {
          console.error(`[Timer] 도착 기록 저장 실패:`, err);
        });
        console.log(`[Timer] ${target.bus_no}@${target.station_name}: 도착 감지 (메인스캔-정보없음) [${plateNoForLog || '번호없음'}]`);
      }

      this.timers.set(target.id, {
        targetId: target.id,
        target,
        timer: null,
        nextCheckAt: new Date(Date.now() + 15 * 60 * 1000), // 메인 타이머에서 복구
        phase: 'waiting',
        lastArrivalSec: null,
        lastPlateNo: existingTimer?.lastPlateNo || null,
      });
      console.log(`[Timer] ${target.bus_no}@${target.station_name}: 도착 정보 없음, 메인 타이머 대기`);
      return;
    }

    // 다음 체크 시간과 phase 계산
    const { delayMs, phase, nextCheckAt } = this.calculateNextCheck(arrivalSec);

    // 새 타이머 설정
    const timer = setTimeout(() => {
      this.onTimerFire(target.id);
    }, delayMs);

    this.timers.set(target.id, {
      targetId: target.id,
      target,
      timer,
      nextCheckAt,
      phase,
      lastArrivalSec: arrivalSec,
      lastPlateNo: plateNo || existingTimer?.lastPlateNo || null,
    });

    const minutes = Math.floor(arrivalSec / 60);
    const delayMinutes = Math.floor(delayMs / 60000);
    const plateInfo = plateNo ? ` [${plateNo}]` : '';
    console.log(
      `[Timer] ${target.bus_no}@${target.station_name}: ` +
      `${minutes}분 후 도착${plateInfo}, ${delayMinutes}분 후 체크 (${phase})`
    );
  }

  /**
   * 다음 체크 시간 계산
   */
  private calculateNextCheck(arrivalSec: number): {
    delayMs: number;
    phase: 'waiting' | 'approaching' | 'imminent';
    nextCheckAt: Date;
  } {
    const now = Date.now();

    if (arrivalSec <= IMMINENT_THRESHOLD) {
      // 곧 도착 (3분 이내) → 1분 후 재체크
      return {
        delayMs: 60 * 1000,
        phase: 'imminent',
        nextCheckAt: new Date(now + 60 * 1000),
      };
    }

    if (arrivalSec <= APPROACH_THRESHOLD) {
      // 접근 중 (3~10분) → (도착-3분) 후 재체크
      const delaySec = Math.max(arrivalSec - IMMINENT_THRESHOLD, 60);
      return {
        delayMs: delaySec * 1000,
        phase: 'approaching',
        nextCheckAt: new Date(now + delaySec * 1000),
      };
    }

    // 여유 있음 (10분+) → (도착-3분) 후 재체크
    const delaySec = Math.max(arrivalSec - IMMINENT_THRESHOLD, 60);
    return {
      delayMs: delaySec * 1000,
      phase: 'waiting',
      nextCheckAt: new Date(now + delaySec * 1000),
    };
  }

  /**
   * 타이머 발동 시 실행
   */
  private async onTimerFire(targetId: string): Promise<void> {
    const state = this.timers.get(targetId);
    if (!state) {
      console.log(`[Timer] ${targetId}: 타이머 상태 없음, 스킵`);
      return;
    }

    const { target, lastArrivalSec, lastPlateNo } = state;
    console.log(`[Timer] ${target.bus_no}@${target.station_name}: 타이머 발동`);

    try {
      // 도착 정보 조회 (API 1회)
      const arrivals = await getBusArrival(target.station_id, target.ars_id || undefined);

      // 해당 버스 찾기
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

      // 도착 감지 로직
      await this.handleArrivalDetection(target, arrivalSec, lastArrivalSec, plateNo, lastPlateNo);

    } catch (error) {
      console.error(`[Timer] ${target.bus_no}@${target.station_name}: 에러`, error);
      // 에러 시 5분 후 재시도
      this.setTimer(target, 300);
    }
  }

  /**
   * 도착 감지 및 기록 처리
   */
  private async handleArrivalDetection(
    target: TrackingTarget,
    arrivalSec: number | null,
    lastArrivalSec: number | null,
    plateNo: string | null,
    lastPlateNo: string | null
  ): Promise<void> {
    const now = new Date();

    // Case 1: 도착 정보 없음 → 버스가 도착했거나 정보 오류
    if (arrivalSec === null) {
      // 이전에 3분 이내였으면 도착으로 판정
      if (lastArrivalSec !== null && lastArrivalSec <= IMMINENT_THRESHOLD) {
        await this.logArrival(target, now, lastPlateNo);
        console.log(`[Timer] ${target.bus_no}@${target.station_name}: 도착 감지 (정보 없음) [${lastPlateNo || '번호없음'}]`);
      } else {
        console.log(`[Timer] ${target.bus_no}@${target.station_name}: 정보 없음, 대기`);
      }
      // 타이머 해제, 메인 타이머에서 복구
      this.clearTimer(target.id);
      return;
    }

    // Case 2: 곧 도착 상태 (3분 이내)
    if (arrivalSec <= IMMINENT_THRESHOLD) {
      console.log(`[Timer] ${target.bus_no}@${target.station_name}: 곧 도착 (${arrivalSec}초) [${plateNo || '번호없음'}]`);
      this.setTimer(target, arrivalSec, plateNo);
      return;
    }

    // Case 3: 이전에 3분 이내였는데 이제 3분 초과 → 도착 완료 (다음 버스 감지)
    if (lastArrivalSec !== null && lastArrivalSec <= IMMINENT_THRESHOLD) {
      await this.logArrival(target, now, lastPlateNo);
      console.log(`[Timer] ${target.bus_no}@${target.station_name}: 도착 감지 (다음 버스 감지) [${lastPlateNo || '번호없음'}]`);
    }

    // 다음 체크 타이머 설정
    this.setTimer(target, arrivalSec, plateNo);
  }

  /**
   * 도착 기록 저장
   */
  private async logArrival(target: TrackingTarget, now: Date, plateNo: string | null): Promise<boolean> {
    const supabase = createServiceClient();

    // 중복 방지: 최근 3분 내 동일 버스/정류소 기록 확인
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
      console.log(`[Timer] ${target.bus_no}@${target.station_name}: 중복 기록 방지`);
      return false;
    }

    // 도착 기록 저장
    const dayOfWeek = now.getDay();
    const { error } = await supabase
      .from('bus_arrival_logs')
      .insert({
        user_id: target.user_id,
        bus_id: target.bus_id,
        bus_no: target.bus_no,
        station_id: target.station_id,
        station_name: target.station_name,
        arrival_time: now.toISOString(),
        day_of_week: dayOfWeek,
        plate_no: plateNo || null,
      });

    if (error) {
      console.error(`[Timer] 도착 기록 저장 실패:`, error.message);
      return false;
    }

    console.log(`[Timer] 도착 기록 저장: ${target.bus_no}@${target.station_name} [${plateNo || '번호없음'}]`);
    return true;
  }

  /**
   * 타이머 해제
   */
  clearTimer(targetId: string): void {
    const state = this.timers.get(targetId);
    if (state?.timer) {
      clearTimeout(state.timer);
    }
    this.timers.delete(targetId);
  }

  /**
   * 모든 타이머 해제
   */
  clearAllTimers(): void {
    for (const [targetId, state] of this.timers) {
      if (state.timer) {
        clearTimeout(state.timer);
      }
    }
    this.timers.clear();
    console.log('[Timer] 모든 타이머 해제됨');
  }

  /**
   * 현재 타이머 상태 조회
   */
  getTimerStatus(): Array<{
    targetId: string;
    busNo: string;
    stationName: string;
    phase: string;
    nextCheckAt: string;
    lastArrivalSec: number | null;
  }> {
    return Array.from(this.timers.values()).map((state) => ({
      targetId: state.targetId,
      busNo: state.target.bus_no,
      stationName: state.target.station_name,
      phase: state.phase,
      nextCheckAt: state.nextCheckAt.toISOString(),
      lastArrivalSec: state.lastArrivalSec,
    }));
  }

  /**
   * 활성 타이머 수
   */
  getActiveTimerCount(): number {
    return Array.from(this.timers.values()).filter((s) => s.timer !== null).length;
  }

  /**
   * 초기화 상태
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  setInitialized(value: boolean): void {
    this.initialized = value;
  }
}

// 싱글톤 인스턴스
export const timerManager = new DynamicTimerManager();
