import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 내 장소 수정
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const { id } = await params;

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

  const { name, place_name, address, x, y, icon, sort_order } = body;

  // 업데이트할 필드만 포함
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (place_name !== undefined) updateData.place_name = place_name;
  if (address !== undefined) updateData.address = address;
  if (x !== undefined) updateData.x = x;
  if (y !== undefined) updateData.y = y;
  if (icon !== undefined) updateData.icon = icon;
  if (sort_order !== undefined) updateData.sort_order = sort_order;

  if (Object.keys(updateData).length === 0) {
    return ApiErrors.badRequest('수정할 내용이 없습니다.');
  }

  const { data, error } = await supabase
    .from('my_places')
    .update(updateData)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return ApiErrors.notFound('해당 장소를 찾을 수 없습니다.');
    }
    return ApiErrors.internalError('내 장소 수정에 실패했습니다.', error.message);
  }

  return successResponse({ place: data });
}

// 내 장소 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const supabase = await createClient();
  const { id } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  const { error } = await supabase
    .from('my_places')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return ApiErrors.internalError('내 장소 삭제에 실패했습니다.', error.message);
  }

  return successResponse({ success: true });
}
