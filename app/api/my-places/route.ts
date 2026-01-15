import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';

export interface MyPlace {
  id: string;
  user_id: string;
  name: string;
  place_name: string;
  address: string | null;
  x: string;
  y: string;
  icon: 'home' | 'office' | 'pin';
  sort_order: number;
  created_at: string;
}

// 내 장소 목록 조회
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  const { data, error } = await supabase
    .from('my_places')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true });

  if (error) {
    return ApiErrors.internalError('내 장소 조회에 실패했습니다.', error.message);
  }

  return successResponse({ places: data as MyPlace[] });
}

// 내 장소 추가
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

  const { name, place_name, address, x, y, icon = 'pin' } = body;

  if (!name || !place_name || !x || !y) {
    return ApiErrors.badRequest('필수 정보가 누락되었습니다. (name, place_name, x, y)');
  }

  // 현재 장소 개수 확인 (5개 제한)
  const { count } = await supabase
    .from('my_places')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (count !== null && count >= 5) {
    return ApiErrors.badRequest('내 장소는 최대 5개까지 등록할 수 있습니다.');
  }

  // 다음 sort_order 계산 (maybeSingle로 빈 결과 처리)
  const { data: maxOrderData } = await supabase
    .from('my_places')
    .select('sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (maxOrderData?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from('my_places')
    .insert({
      user_id: user.id,
      name,
      place_name,
      address,
      x,
      y,
      icon,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    if (error.message.includes('Maximum 5 places')) {
      return ApiErrors.badRequest('내 장소는 최대 5개까지 등록할 수 있습니다.');
    }
    return ApiErrors.internalError('내 장소 추가에 실패했습니다.', error.message);
  }

  return successResponse({ place: data as MyPlace }, 201);
}
