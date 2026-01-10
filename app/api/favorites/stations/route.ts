import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';

// 즐겨찾기 정류소 조회
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  const { data, error } = await supabase
    .from('favorite_stations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return ApiErrors.internalError('즐겨찾기 조회에 실패했습니다.', error.message);
  }

  return successResponse({ stations: data });
}

// 즐겨찾기 정류소 추가
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

  const { station_id, station_name, x, y } = body;

  if (!station_id || !station_name) {
    return ApiErrors.badRequest('정류소 정보가 필요합니다.');
  }

  const { data, error } = await supabase
    .from('favorite_stations')
    .insert({
      user_id: user.id,
      station_id,
      station_name,
      x,
      y,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: '이미 즐겨찾기에 추가된 정류소입니다.', code: 'DUPLICATE' },
        { status: 409 }
      );
    }
    return ApiErrors.internalError('즐겨찾기 추가에 실패했습니다.', error.message);
  }

  return successResponse({ station: data }, 201);
}

// 즐겨찾기 정류소 삭제
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  const searchParams = request.nextUrl.searchParams;
  const stationId = searchParams.get('stationId');

  if (!stationId) {
    return ApiErrors.badRequest('정류소 ID가 필요합니다.');
  }

  const { error } = await supabase
    .from('favorite_stations')
    .delete()
    .eq('station_id', stationId)
    .eq('user_id', user.id);

  if (error) {
    return ApiErrors.internalError('즐겨찾기 삭제에 실패했습니다.', error.message);
  }

  return successResponse({ success: true });
}
