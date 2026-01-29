import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ApiErrors, successResponse } from '@/lib/api-response';

// GET: 버스 도착 로그 조회
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  const { searchParams } = new URL(request.url);
  const bus_id = searchParams.get('bus_id');
  const station_id = searchParams.get('station_id');
  const days = parseInt(searchParams.get('days') || '30', 10);

  let query = supabase
    .from('bus_arrival_logs')
    .select('*')
    .eq('user_id', user.id)
    .gte(
      'arrival_time',
      new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    )
    .order('arrival_time', { ascending: false });

  if (bus_id) {
    query = query.eq('bus_id', bus_id);
  }

  if (station_id) {
    query = query.eq('station_id', station_id);
  }

  const { data, error } = await query;

  if (error) {
    return ApiErrors.internalError('도착 로그 조회에 실패했습니다.', error.message);
  }

  return successResponse({ logs: data });
}

// POST: 버스 도착 로그 추가
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

  const { bus_id, bus_no, station_id, station_name, arrival_time, plate_no } = body;

  if (!bus_id || !bus_no || !station_id || !station_name) {
    return ApiErrors.badRequest('버스 ID, 노선번호, 정류소 ID, 정류소명이 필요합니다.');
  }

  const arrivalDate = arrival_time ? new Date(arrival_time) : new Date();
  const dayOfWeek = arrivalDate.getDay();

  const { data, error } = await supabase
    .from('bus_arrival_logs')
    .insert({
      user_id: user.id,
      bus_id,
      bus_no,
      station_id,
      station_name,
      arrival_time: arrivalDate.toISOString(),
      day_of_week: dayOfWeek,
      plate_no: plate_no || null,
    })
    .select()
    .single();

  if (error) {
    return ApiErrors.internalError('도착 로그 추가에 실패했습니다.', error.message);
  }

  return successResponse({ log: data }, 201);
}

// DELETE: 버스 도착 로그 삭제
// - id: 단일 로그 삭제
// - date + bus_id + station_id: 특정 날짜의 모든 로그 삭제
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
  const date = searchParams.get('date');
  const bus_id = searchParams.get('bus_id');
  const station_id = searchParams.get('station_id');

  // 날짜별 삭제 (KST 기준)
  if (date && bus_id && station_id) {
    // date는 'YYYY-MM-DD' 형식의 KST 기준 날짜
    // KST 00:00:00 = UTC 전날 15:00:00 (UTC+9)
    // KST 23:59:59 = UTC 당일 14:59:59
    const [year, month, day] = date.split('-').map(Number);

    // KST 기준 시작/종료 시간을 UTC로 변환
    const startOfDayKST = new Date(Date.UTC(year, month - 1, day, -9, 0, 0, 0)); // KST 00:00 = UTC -9시간
    const endOfDayKST = new Date(Date.UTC(year, month - 1, day, 14, 59, 59, 999)); // KST 23:59:59 = UTC +14:59:59

    const { data: deletedLogs, error } = await supabase
      .from('bus_arrival_logs')
      .delete()
      .eq('user_id', user.id)
      .eq('bus_id', bus_id)
      .eq('station_id', station_id)
      .gte('arrival_time', startOfDayKST.toISOString())
      .lte('arrival_time', endOfDayKST.toISOString())
      .select('id');

    if (error) {
      return ApiErrors.internalError('날짜별 로그 삭제에 실패했습니다.', error.message);
    }

    return successResponse({
      success: true,
      deletedCount: deletedLogs?.length || 0
    });
  }

  // 단일 로그 삭제
  if (!id) {
    return ApiErrors.badRequest('로그 ID 또는 날짜 정보가 필요합니다.');
  }

  const { error } = await supabase
    .from('bus_arrival_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    return ApiErrors.internalError('도착 로그 삭제에 실패했습니다.', error.message);
  }

  return successResponse({ success: true });
}
