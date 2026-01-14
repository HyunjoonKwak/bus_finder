import { createServiceClient } from '@/lib/supabase/service';
import { sendTelegramMessage, formatLastBusMessage } from '@/lib/notifications/telegram';
import { sendDiscordMessage, createLastBusEmbed } from '@/lib/notifications/discord';

interface NotificationSetting {
  id: string;
  user_id: string;
  notification_type: string;
  target_id: string | null;
  target_name: string | null;
  minutes_before: number;
  webhook_type: string;
  webhook_url: string;
  is_enabled: boolean;
  last_bus_time: string | null;
  last_notified_at: string | null;
}

interface TrackingTarget {
  id: string;
  user_id: string;
  bus_id: string;
  bus_no: string;
  station_id: string;
  station_name: string;
}

/**
 * 막차 알림 체크 및 발송
 * Cron에서 주기적으로 호출됨
 */
export async function checkLastBusAlerts(): Promise<{
  checked: number;
  sent: number;
  errors: string[];
}> {
  const supabase = createServiceClient();
  const now = new Date();
  const errors: string[] = [];
  let checked = 0;
  let sent = 0;

  try {
    // 1. 활성화된 막차 알림 설정 조회
    const { data: notifications, error: notifError } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('notification_type', 'last_bus')
      .eq('is_enabled', true);

    if (notifError) {
      errors.push(`Failed to fetch notifications: ${notifError.message}`);
      return { checked, sent, errors };
    }

    if (!notifications || notifications.length === 0) {
      console.log('[LastBus] No active last bus notifications');
      return { checked, sent, errors };
    }

    console.log(`[LastBus] Checking ${notifications.length} notifications`);

    for (const notif of notifications as NotificationSetting[]) {
      checked++;

      try {
        // target_id가 없으면 건너뜀
        if (!notif.target_id) {
          continue;
        }

        // 2. 해당 추적 대상의 버스 정보 조회
        const { data: target, error: targetError } = await supabase
          .from('bus_tracking_targets')
          .select('*')
          .eq('id', notif.target_id)
          .single();

        if (targetError || !target) {
          continue;
        }

        const trackingTarget = target as TrackingTarget;

        // 3. 막차 시간 확인 (API에서 가져오거나 설정에서 가져옴)
        let lastBusTime = notif.last_bus_time;

        if (!lastBusTime) {
          // API에서 막차 시간 가져오기 시도
          lastBusTime = await fetchLastBusTime(trackingTarget.bus_id);

          if (lastBusTime) {
            // 막차 시간 저장
            await supabase
              .from('notification_settings')
              .update({ last_bus_time: lastBusTime })
              .eq('id', notif.id);
          }
        }

        if (!lastBusTime) {
          console.log(`[LastBus] No last bus time for ${trackingTarget.bus_no}`);
          continue;
        }

        // 4. 막차 알림 시간 계산
        const shouldNotify = shouldSendLastBusAlert(
          lastBusTime,
          notif.minutes_before,
          notif.last_notified_at,
          now
        );

        if (!shouldNotify) {
          continue;
        }

        // 5. 알림 발송
        const sendResult = await sendNotification(
          notif,
          trackingTarget.bus_no,
          trackingTarget.station_name,
          lastBusTime
        );

        if (sendResult.success) {
          sent++;

          // 마지막 알림 시간 업데이트
          await supabase
            .from('notification_settings')
            .update({ last_notified_at: now.toISOString() })
            .eq('id', notif.id);

          console.log(`[LastBus] Alert sent: ${trackingTarget.bus_no} @ ${trackingTarget.station_name}`);
        } else {
          errors.push(`Send failed for ${trackingTarget.bus_no}: ${sendResult.error}`);
        }
      } catch (notifError) {
        const errMsg = notifError instanceof Error ? notifError.message : String(notifError);
        errors.push(`Notification ${notif.id}: ${errMsg}`);
      }
    }

    console.log(`[LastBus] Complete: ${checked} checked, ${sent} sent`);
    return { checked, sent, errors };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    errors.push(`LastBus alert error: ${errMsg}`);
    return { checked, sent, errors };
  }
}

/**
 * 막차 시간을 API에서 가져오기
 */
async function fetchLastBusTime(busId: string): Promise<string | null> {
  try {
    // 버스 노선 정보 API 호출
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/bus/route?busId=${busId}`);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();

    // busLastTime 필드에서 막차 시간 추출
    if (data.route?.busLastTime) {
      return data.route.busLastTime;
    }

    return null;
  } catch (error) {
    console.error('[LastBus] Failed to fetch last bus time:', error);
    return null;
  }
}

/**
 * 막차 알림을 보내야 하는지 확인
 */
function shouldSendLastBusAlert(
  lastBusTime: string,
  minutesBefore: number,
  lastNotifiedAt: string | null,
  now: Date
): boolean {
  // 막차 시간 파싱 (HH:MM 형식)
  const [hours, minutes] = lastBusTime.split(':').map(Number);

  if (isNaN(hours) || isNaN(minutes)) {
    return false;
  }

  // 오늘의 막차 시간 계산
  const lastBusDate = new Date(now);
  lastBusDate.setHours(hours, minutes, 0, 0);

  // 막차가 자정 이후인 경우 (예: 00:30) 내일로 처리
  if (hours < 4 && now.getHours() >= 20) {
    lastBusDate.setDate(lastBusDate.getDate() + 1);
  }

  // 알림 시간 계산 (막차 N분 전)
  const alertTime = new Date(lastBusDate.getTime() - minutesBefore * 60 * 1000);

  // 현재 시간이 알림 시간 범위 내인지 확인 (알림 시간 ~ 알림 시간 + 5분)
  const alertWindowEnd = new Date(alertTime.getTime() + 5 * 60 * 1000);
  const isInAlertWindow = now >= alertTime && now <= alertWindowEnd;

  if (!isInAlertWindow) {
    return false;
  }

  // 오늘 이미 알림을 보냈는지 확인
  if (lastNotifiedAt) {
    const lastNotified = new Date(lastNotifiedAt);
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    // 오늘 이미 알림을 보냈으면 건너뜀
    if (lastNotified >= todayStart) {
      return false;
    }
  }

  return true;
}

/**
 * 알림 발송
 */
async function sendNotification(
  notif: NotificationSetting,
  busNo: string,
  stationName: string,
  lastBusTime: string
): Promise<{ success: boolean; error?: string }> {
  if (notif.webhook_type === 'telegram') {
    // webhook_url 형식: "telegram:botToken:chatId"
    const parts = notif.webhook_url.split(':');
    if (parts.length < 3 || parts[0] !== 'telegram') {
      return { success: false, error: 'Invalid telegram webhook format' };
    }

    const botToken = parts.slice(1, -1).join(':'); // 토큰에 ":"가 포함될 수 있음
    const chatId = parts[parts.length - 1];
    const message = formatLastBusMessage(busNo, stationName, lastBusTime);

    return await sendTelegramMessage(botToken, chatId, message);
  } else if (notif.webhook_type === 'discord') {
    const embed = createLastBusEmbed(busNo, stationName, lastBusTime);
    return await sendDiscordMessage(notif.webhook_url, undefined, [embed]);
  }

  return { success: false, error: 'Unknown webhook type' };
}
