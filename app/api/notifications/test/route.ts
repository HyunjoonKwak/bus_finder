import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTelegramMessage, formatBusArrivalMessage } from '@/lib/notifications/telegram';
import { sendDiscordMessage, createBusArrivalEmbed } from '@/lib/notifications/discord';

// POST: 알림 테스트 전송
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { webhook_type, webhook_url, bot_token, chat_id } = body;

  if (!webhook_type) {
    return NextResponse.json(
      { error: 'webhook_type is required' },
      { status: 400 }
    );
  }

  // 테스트 메시지 데이터
  const testBusNo = '143';
  const testStationName = '강남역';
  const testMinutes = 5;
  const testLeftStations = 3;

  try {
    if (webhook_type === 'telegram') {
      if (!bot_token || !chat_id) {
        return NextResponse.json(
          { error: 'bot_token and chat_id are required for telegram' },
          { status: 400 }
        );
      }

      const message = formatBusArrivalMessage(
        testBusNo,
        testStationName,
        testMinutes,
        testLeftStations
      );

      const result = await sendTelegramMessage(bot_token, chat_id, message);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Telegram send failed' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: '테스트 메시지가 전송되었습니다.' });
    }

    if (webhook_type === 'discord') {
      if (!webhook_url) {
        return NextResponse.json(
          { error: 'webhook_url is required for discord' },
          { status: 400 }
        );
      }

      const embed = createBusArrivalEmbed(
        testBusNo,
        testStationName,
        testMinutes,
        testLeftStations
      );

      const result = await sendDiscordMessage(webhook_url, undefined, [embed]);

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Discord send failed' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true, message: '테스트 메시지가 전송되었습니다.' });
    }

    return NextResponse.json(
      { error: 'Invalid webhook_type' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Notification test error:', error);
    return NextResponse.json(
      { error: 'Failed to send test notification' },
      { status: 500 }
    );
  }
}
