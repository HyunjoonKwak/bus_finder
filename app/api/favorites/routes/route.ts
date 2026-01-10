import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';

// 즐겨찾기 노선 조회
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  const { data, error } = await supabase
    .from('favorite_routes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return ApiErrors.internalError('즐겨찾기 조회에 실패했습니다.', error.message);
  }

  return successResponse({ routes: data });
}

// 즐겨찾기 노선 추가
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

  const { bus_id, bus_no, bus_type } = body;

  if (!bus_id || !bus_no) {
    return ApiErrors.badRequest('버스 정보가 필요합니다.');
  }

  const { data, error } = await supabase
    .from('favorite_routes')
    .insert({
      user_id: user.id,
      bus_id,
      bus_no,
      bus_type: bus_type || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: '이미 즐겨찾기에 추가된 노선입니다.', code: 'DUPLICATE' },
        { status: 409 }
      );
    }
    return ApiErrors.internalError('즐겨찾기 추가에 실패했습니다.', error.message);
  }

  return successResponse({ route: data }, 201);
}

// 즐겨찾기 노선 삭제
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  const searchParams = request.nextUrl.searchParams;
  const busId = searchParams.get('busId');

  if (!busId) {
    return ApiErrors.badRequest('버스 ID가 필요합니다.');
  }

  const { error } = await supabase
    .from('favorite_routes')
    .delete()
    .eq('bus_id', busId)
    .eq('user_id', user.id);

  if (error) {
    return ApiErrors.internalError('즐겨찾기 삭제에 실패했습니다.', error.message);
  }

  return successResponse({ success: true });
}
