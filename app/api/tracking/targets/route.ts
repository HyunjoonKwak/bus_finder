import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';

// GET: 버스 추적 대상 목록 조회
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  const { data, error } = await supabase
    .from('bus_tracking_targets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return ApiErrors.internalError('추적 대상 조회에 실패했습니다.', error.message);
  }

  return successResponse({ targets: data });
}

// POST: 버스 추적 대상 추가
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

  const { bus_id, bus_no, station_id, station_name, ars_id } = body;

  if (!bus_id || !bus_no || !station_id || !station_name) {
    return ApiErrors.badRequest('버스 ID, 노선번호, 정류소 ID, 정류소명이 필요합니다.');
  }

  const { data, error } = await supabase
    .from('bus_tracking_targets')
    .insert({
      user_id: user.id,
      bus_id,
      bus_no,
      station_id,
      station_name,
      ars_id: ars_id || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: '이미 추적 중인 버스+정류소 조합입니다.', code: 'DUPLICATE' },
        { status: 409 }
      );
    }
    // 제한 초과 에러 처리
    if (error.message?.includes('Maximum number of stations')) {
      return NextResponse.json(
        { error: '최대 정류소 수(10개)에 도달했습니다. 기존 정류소를 삭제해주세요.', code: 'STATION_LIMIT' },
        { status: 400 }
      );
    }
    if (error.message?.includes('Maximum number of tracking targets')) {
      return NextResponse.json(
        { error: '최대 추적 대상 수(20개)에 도달했습니다. 기존 대상을 삭제해주세요.', code: 'TARGET_LIMIT' },
        { status: 400 }
      );
    }
    return ApiErrors.internalError('추적 대상 추가에 실패했습니다.', error.message);
  }

  return successResponse({ target: data }, 201);
}

// DELETE: 버스 추적 대상 삭제
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
    return ApiErrors.badRequest('추적 대상 ID가 필요합니다.');
  }

  const { error } = await supabase
    .from('bus_tracking_targets')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return ApiErrors.internalError('추적 대상 삭제에 실패했습니다.', error.message);
  }

  return successResponse({ success: true });
}

// PATCH: 버스 추적 대상 활성화/비활성화
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
    return ApiErrors.badRequest('추적 대상 ID와 활성화 상태가 필요합니다.');
  }

  const { data, error } = await supabase
    .from('bus_tracking_targets')
    .update({ is_active })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    // 제한 초과 에러 처리
    if (error.message?.includes('Maximum number of stations')) {
      return NextResponse.json(
        { error: '최대 정류소 수(10개)에 도달했습니다.', code: 'STATION_LIMIT' },
        { status: 400 }
      );
    }
    if (error.message?.includes('Maximum number of tracking targets')) {
      return NextResponse.json(
        { error: '최대 추적 대상 수(20개)에 도달했습니다.', code: 'TARGET_LIMIT' },
        { status: 400 }
      );
    }
    return ApiErrors.internalError('추적 대상 업데이트에 실패했습니다.', error.message);
  }

  return successResponse({ target: data });
}
