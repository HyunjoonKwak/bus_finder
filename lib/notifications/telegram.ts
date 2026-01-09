/**
 * 텔레그램 웹훅 유틸리티
 */

interface TelegramSendResult {
  success: boolean;
  error?: string;
}

/**
 * 텔레그램 봇으로 메시지 전송
 * @param botToken 텔레그램 봇 토큰
 * @param chatId 채팅 ID
 * @param message 메시지 내용
 */
export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<TelegramSendResult> {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.description || 'Telegram API error',
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
 * 버스 도착 알림 메시지 생성
 */
export function formatBusArrivalMessage(
  busNo: string,
  stationName: string,
  arrivalMinutes: number,
  leftStations: number
): string {
  return `🚌 <b>${busNo}</b> 버스 도착 알림

📍 정류소: ${stationName}
⏱ 도착 예정: <b>${arrivalMinutes}분 후</b>
📌 남은 정류장: ${leftStations}개

버스타볼까 앱에서 확인하세요!`;
}

/**
 * 막차 알림 메시지 생성
 */
export function formatLastBusMessage(
  busNo: string,
  stationName: string,
  lastBusTime: string
): string {
  return `⚠️ <b>${busNo}</b> 막차 알림

📍 정류소: ${stationName}
🕐 막차 시간: <b>${lastBusTime}</b>

막차를 놓치지 마세요!`;
}
