import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: 알림 설정 목록 조회
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Notification settings fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ settings: data });
}

// POST: 알림 설정 추가
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const {
    notification_type,
    target_id,
    target_name,
    minutes_before,
    webhook_type,
    webhook_url,
  } = body;

  if (!notification_type || !webhook_type || !webhook_url) {
    return NextResponse.json(
      { error: 'notification_type, webhook_type, webhook_url are required' },
      { status: 400 }
    );
  }

  // 웹훅 타입 검증
  if (!['telegram', 'discord'].includes(webhook_type)) {
    return NextResponse.json(
      { error: 'webhook_type must be telegram or discord' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('notification_settings')
    .insert({
      user_id: user.id,
      notification_type,
      target_id,
      target_name,
      minutes_before: minutes_before || 5,
      webhook_type,
      webhook_url,
      is_enabled: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Notification setting insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ setting: data });
}

// DELETE: 알림 설정 삭제
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('notification_settings')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Notification setting delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH: 알림 설정 수정
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, is_enabled, minutes_before, webhook_url } = body;

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof is_enabled === 'boolean') updates.is_enabled = is_enabled;
  if (typeof minutes_before === 'number') updates.minutes_before = minutes_before;
  if (typeof webhook_url === 'string') updates.webhook_url = webhook_url;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: 'No valid fields to update' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('notification_settings')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Notification setting update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ setting: data });
}
