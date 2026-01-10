import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramMessage, formatBusArrivalMessage } from '@/lib/notifications/telegram';
import { sendDiscordMessage, createBusArrivalEmbed } from '@/lib/notifications/discord';
import { ApiErrors, successResponse } from '@/lib/api-response';

// POST: 알림 테스트 전송
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return ApiErrors.badRequest('잘못된 요청 형식입니다.');
  }

  const { webhook_type, webhook_url, bot_token, chat_id } = body;

  if (!webhook_type) {
    return ApiErrors.badRequest('웹훅 유형이 필요합니다.');
  }

  // 테스트 메시지 데이터
  const testBusNo = '143';
  const testStationName = '강남역';
  const testMinutes = 5;
  const testLeftStations = 3;

  try {
    if (webhook_type === 'telegram') {
      if (!bot_token || !chat_id) {
        return ApiErrors.badRequest('텔레그램은 bot_token과 chat_id가 필요합니다.');
      }

      const message = formatBusArrivalMessage(
        testBusNo,
        testStationName,
        testMinutes,
        testLeftStations
      );

      const result = await sendTelegramMessage(bot_token, chat_id, message);

      if (!result.success) {
        return ApiErrors.externalApiError('Telegram', result.error);
      }

      return successResponse({ success: true, message: '테스트 메시지가 전송되었습니다.' });
    }

    if (webhook_type === 'discord') {
      if (!webhook_url) {
        return ApiErrors.badRequest('디스코드는 webhook_url이 필요합니다.');
      }

      const embed = createBusArrivalEmbed(
        testBusNo,
        testStationName,
        testMinutes,
        testLeftStations
      );

      const result = await sendDiscordMessage(webhook_url, undefined, [embed]);

      if (!result.success) {
        return ApiErrors.externalApiError('Discord', result.error);
      }

      return successResponse({ success: true, message: '테스트 메시지가 전송되었습니다.' });
    }

    return ApiErrors.badRequest('유효하지 않은 웹훅 유형입니다.');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '알 수 없는 오류';
    return ApiErrors.internalError('테스트 알림 전송에 실패했습니다.', errorMessage);
  }
}
