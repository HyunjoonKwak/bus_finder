/**
 * 디스코드 웹훅 유틸리티
 */

interface DiscordSendResult {
  success: boolean;
  error?: string;
}

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
}

/**
 * 디스코드 웹훅으로 메시지 전송
 * @param webhookUrl 디스코드 웹훅 URL
 * @param message 메시지 내용
 * @param embeds 임베드 (선택)
 */
export async function sendDiscordMessage(
  webhookUrl: string,
  message?: string,
  embeds?: DiscordEmbed[]
): Promise<DiscordSendResult> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: message,
        embeds,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        success: false,
        error: text || 'Discord webhook error',
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * 버스 도착 알림 임베드 생성
 */
export function createBusArrivalEmbed(
  busNo: string,
  stationName: string,
  arrivalMinutes: number,
  leftStations: number
): DiscordEmbed {
  return {
    title: `🚌 ${busNo} 버스 도착 알림`,
    color: 0x10b981, // emerald-500
    fields: [
      { name: '📍 정류소', value: stationName, inline: true },
      { name: '⏱ 도착 예정', value: `${arrivalMinutes}분 후`, inline: true },
      { name: '📌 남은 정류장', value: `${leftStations}개`, inline: true },
    ],
    timestamp: new Date().toISOString(),
  };
}

/**
 * 막차 알림 임베드 생성
 */
export function createLastBusEmbed(
  busNo: string,
  stationName: string,
  lastBusTime: string
): DiscordEmbed {
  return {
    title: `⚠️ ${busNo} 막차 알림`,
    color: 0xf59e0b, // amber-500
    fields: [
      { name: '📍 정류소', value: stationName, inline: true },
      { name: '🕐 막차 시간', value: lastBusTime, inline: true },
    ],
    description: '막차를 놓치지 마세요!',
    timestamp: new Date().toISOString(),
  };
}
