import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // 비로그인 시 빈 배열 반환 (에러 아님)
      return successResponse({ history: [] });
    }

    const { data, error } = await supabase
      .from('route_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Route history fetch error:', error);
      return successResponse({ history: [] });
    }

    return successResponse({ history: data || [] });
  } catch (error) {
    console.error('Route history error:', error);
    return successResponse({ history: [] });
  }
}

export async function POST(request: Request) {
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

  const { originName, originAddress, originX, originY, destName, destAddress, destX, destY } = body;

  if (!originName || !originX || !originY || !destName || !destX || !destY) {
    return ApiErrors.badRequest('필수 정보가 누락되었습니다.');
  }

  // 중복 방지: 같은 출발지/도착지가 최근 1분 내에 있으면 저장하지 않음
  const { data: recent } = await supabase
    .from('route_history')
    .select('id')
    .eq('user_id', user.id)
    .eq('origin_x', originX)
    .eq('origin_y', originY)
    .eq('dest_x', destX)
    .eq('dest_y', destY)
    .gte('created_at', new Date(Date.now() - 60000).toISOString())
    .limit(1);

  if (recent && recent.length > 0) {
    return successResponse({ success: true, message: '이미 최근에 저장됨' });
  }

  const { data, error } = await supabase
    .from('route_history')
    .insert({
      user_id: user.id,
      origin_name: originName,
      origin_address: originAddress || null,
      origin_x: originX,
      origin_y: originY,
      dest_name: destName,
      dest_address: destAddress || null,
      dest_x: destX,
      dest_y: destY,
    })
    .select()
    .single();

  if (error) {
    console.error('Route history insert error:', error);
    return ApiErrors.internalError('저장에 실패했습니다.', error.message);
  }

  return successResponse({ success: true, history: data }, 201);
}
