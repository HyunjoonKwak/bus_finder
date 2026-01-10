import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  // 설정 조회 (없으면 기본값 반환)
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows found
    return ApiErrors.internalError('설정 조회에 실패했습니다.', error.message);
  }

  // 설정이 없으면 기본값 반환
  const settings = data || {
    bg_collection_enabled: false,
    bg_collection_interval: 300,
  };

  return successResponse({ settings });
}

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

  const { bg_collection_enabled, bg_collection_interval } = body;

  // upsert: 있으면 업데이트, 없으면 생성
  const { data, error } = await supabase
    .from('user_settings')
    .upsert(
      {
        user_id: user.id,
        bg_collection_enabled:
          bg_collection_enabled !== undefined ? bg_collection_enabled : false,
        bg_collection_interval: bg_collection_interval || 300,
      },
      { onConflict: 'user_id' }
    )
    .select()
    .single();

  if (error) {
    return ApiErrors.internalError('설정 저장에 실패했습니다.', error.message);
  }

  return successResponse({ settings: data });
}
