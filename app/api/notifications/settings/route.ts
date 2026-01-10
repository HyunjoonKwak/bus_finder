import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';

// GET: 알림 설정 목록 조회
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return ApiErrors.internalError('알림 설정 조회에 실패했습니다.', error.message);
  }

  return successResponse({ settings: data });
}

// POST: 알림 설정 추가
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

  const {
    notification_type,
    target_id,
    target_name,
    minutes_before,
    webhook_type,
    webhook_url,
  } = body;

  if (!notification_type || !webhook_type || !webhook_url) {
    return ApiErrors.badRequest('알림 유형, 웹훅 유형, 웹훅 URL이 필요합니다.');
  }

  if (!['telegram', 'discord'].includes(webhook_type)) {
    return ApiErrors.badRequest('웹훅 유형은 telegram 또는 discord여야 합니다.');
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
    return ApiErrors.internalError('알림 설정 추가에 실패했습니다.', error.message);
  }

  return successResponse({ setting: data }, 201);
}

// DELETE: 알림 설정 삭제
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return ApiErrors.badRequest('알림 설정 ID가 필요합니다.');
  }

  const { error } = await supabase
    .from('notification_settings')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return ApiErrors.internalError('알림 설정 삭제에 실패했습니다.', error.message);
  }

  return successResponse({ success: true });
}

// PATCH: 알림 설정 수정
export async function PATCH(request: NextRequest) {
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

  const { id, is_enabled, minutes_before, webhook_url } = body;

  if (!id) {
    return ApiErrors.badRequest('알림 설정 ID가 필요합니다.');
  }

  const updates: Record<string, unknown> = {};
  if (typeof is_enabled === 'boolean') updates.is_enabled = is_enabled;
  if (typeof minutes_before === 'number') updates.minutes_before = minutes_before;
  if (typeof webhook_url === 'string') updates.webhook_url = webhook_url;

  if (Object.keys(updates).length === 0) {
    return ApiErrors.badRequest('업데이트할 필드가 없습니다.');
  }

  const { data, error } = await supabase
    .from('notification_settings')
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return ApiErrors.internalError('알림 설정 업데이트에 실패했습니다.', error.message);
  }

  return successResponse({ setting: data });
}
