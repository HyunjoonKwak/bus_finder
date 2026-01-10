import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';

// 탑승 기록 조회
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  const { data, error } = await supabase
    .from('transport_history')
    .select('*')
    .eq('user_id', user.id)
    .order('boarded_at', { ascending: false });

  if (error) {
    return ApiErrors.internalError('탑승 기록 조회에 실패했습니다.', error.message);
  }

  return successResponse({ history: data });
}

// 탑승 기록 생성
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

  const { origin_name, dest_name, route_data, total_time } = body;

  if (!origin_name || !dest_name) {
    return ApiErrors.badRequest('출발지와 도착지를 입력해주세요.');
  }

  const { data, error } = await supabase
    .from('transport_history')
    .insert({
      user_id: user.id,
      origin_name,
      dest_name,
      route_data,
      total_time,
    })
    .select()
    .single();

  if (error) {
    return ApiErrors.internalError('탑승 기록 생성에 실패했습니다.', error.message);
  }

  return successResponse({ history: data }, 201);
}
