import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';
import type { StationPair } from '@/types/stats';

// DB Row를 API 응답 형식으로 변환
function toStationPair(row: {
  id: string;
  user_id: string;
  bus_id: string;
  bus_no: string;
  station_a_id: string;
  station_a_name: string;
  station_a_ars_id: string | null;
  station_b_id: string;
  station_b_name: string;
  station_b_ars_id: string | null;
  name: string | null;
  created_at: string;
}): StationPair {
  return {
    id: row.id,
    userId: row.user_id,
    busId: row.bus_id,
    busNo: row.bus_no,
    stationA: {
      id: row.station_a_id,
      name: row.station_a_name,
      arsId: row.station_a_ars_id,
    },
    stationB: {
      id: row.station_b_id,
      name: row.station_b_name,
      arsId: row.station_b_ars_id,
    },
    name: row.name,
    createdAt: row.created_at,
  };
}

/**
 * GET /api/tracking/pairs
 * 페어 정류장 목록 조회
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const busId = searchParams.get('busId');

  let query = supabase
    .from('station_pairs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (busId) {
    query = query.eq('bus_id', busId);
  }

  const { data, error } = await query;

  if (error) {
    return ApiErrors.internalError('페어 목록 조회에 실패했습니다.', error.message);
  }

  const pairs = (data || []).map(toStationPair);

  return successResponse({ pairs });
}

/**
 * POST /api/tracking/pairs
 * 페어 정류장 생성
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized();
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return ApiErrors.badRequest('잘못된 요청 형식입니다.');
  }

  const {
    busId,
    busNo,
    stationA,
    stationB,
    name,
  } = body;

  // 필수 필드 검증
  if (!busId || !busNo) {
    return ApiErrors.badRequest('버스 정보가 필요합니다.');
  }

  if (!stationA?.id || !stationA?.name || !stationB?.id || !stationB?.name) {
    return ApiErrors.badRequest('정류장 A와 B 정보가 필요합니다.');
  }

  if (stationA.id === stationB.id) {
    return ApiErrors.badRequest('같은 정류장은 페어로 설정할 수 없습니다.');
  }

  // 중복 체크
  const { data: existing } = await supabase
    .from('station_pairs')
    .select('id')
    .eq('user_id', user.id)
    .eq('bus_id', busId)
    .eq('station_a_id', stationA.id)
    .eq('station_b_id', stationB.id)
    .single();

  if (existing) {
    return ApiErrors.badRequest('이미 동일한 페어가 존재합니다.');
  }

  const { data, error } = await supabase
    .from('station_pairs')
    .insert({
      user_id: user.id,
      bus_id: busId,
      bus_no: busNo,
      station_a_id: stationA.id,
      station_a_name: stationA.name,
      station_a_ars_id: stationA.arsId || null,
      station_b_id: stationB.id,
      station_b_name: stationB.name,
      station_b_ars_id: stationB.arsId || null,
      name: name || null,
    })
    .select()
    .single();

  if (error) {
    return ApiErrors.internalError('페어 생성에 실패했습니다.', error.message);
  }

  return successResponse({ pair: toStationPair(data) });
}

/**
 * DELETE /api/tracking/pairs
 * 페어 정류장 삭제
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized();
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return ApiErrors.badRequest('페어 ID가 필요합니다.');
  }

  const { error } = await supabase
    .from('station_pairs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return ApiErrors.internalError('페어 삭제에 실패했습니다.', error.message);
  }

  return successResponse({ success: true });
}
