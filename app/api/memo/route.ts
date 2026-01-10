import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';

// 메모 조회
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  const { data, error } = await supabase
    .from('transport_memo')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return ApiErrors.internalError('메모 조회에 실패했습니다.', error.message);
  }

  return successResponse({ memos: data });
}

// 메모 생성
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

  const { route_id, route_name, content } = body;

  if (!route_id || !content) {
    return ApiErrors.badRequest('노선 ID와 내용을 입력해주세요.');
  }

  const { data, error } = await supabase
    .from('transport_memo')
    .insert({
      user_id: user.id,
      route_id,
      route_name,
      content,
    })
    .select()
    .single();

  if (error) {
    return ApiErrors.internalError('메모 생성에 실패했습니다.', error.message);
  }

  return successResponse({ memo: data }, 201);
}

// 메모 삭제
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  const searchParams = request.nextUrl.searchParams;
  const id = searchParams.get('id');

  if (!id) {
    return ApiErrors.badRequest('메모 ID가 필요합니다.');
  }

  const { error } = await supabase
    .from('transport_memo')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return ApiErrors.internalError('메모 삭제에 실패했습니다.', error.message);
  }

  return successResponse({ success: true });
}
