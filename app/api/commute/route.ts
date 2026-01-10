import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';

// GET: 출퇴근 경로 목록 조회
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  const { data, error } = await supabase
    .from('commute_routes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return ApiErrors.internalError('출퇴근 경로 조회에 실패했습니다.', error.message);
  }

  return successResponse({ routes: data });
}

// POST: 출퇴근 경로 추가
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

  const { name, origin_name, origin_x, origin_y, dest_name, dest_x, dest_y } =
    body;

  if (!name || !origin_name || !dest_name) {
    return ApiErrors.badRequest('경로 이름, 출발지, 도착지가 필요합니다.');
  }

  const { data, error } = await supabase
    .from('commute_routes')
    .insert({
      user_id: user.id,
      name,
      origin_name,
      origin_x,
      origin_y,
      dest_name,
      dest_x,
      dest_y,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    return ApiErrors.internalError('출퇴근 경로 추가에 실패했습니다.', error.message);
  }

  return successResponse({ route: data }, 201);
}

// DELETE: 출퇴근 경로 삭제
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
    return ApiErrors.badRequest('경로 ID가 필요합니다.');
  }

  const { error } = await supabase
    .from('commute_routes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return ApiErrors.internalError('출퇴근 경로 삭제에 실패했습니다.', error.message);
  }

  return successResponse({ success: true });
}

// PATCH: 출퇴근 경로 활성화/비활성화
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

  const { id, is_active } = body;

  if (!id || typeof is_active !== 'boolean') {
    return ApiErrors.badRequest('경로 ID와 활성화 상태가 필요합니다.');
  }

  const { data, error } = await supabase
    .from('commute_routes')
    .update({ is_active })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    return ApiErrors.internalError('출퇴근 경로 업데이트에 실패했습니다.', error.message);
  }

  return successResponse({ route: data });
}
