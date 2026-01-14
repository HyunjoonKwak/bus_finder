import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { ApiErrors, successResponse } from '@/lib/api-response';

// GET: API 사용량 조회 (최근 7일)
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return ApiErrors.unauthorized('로그인이 필요합니다.');
  }

  // 서비스 클라이언트로 API 카운터 조회
  const serviceClient = createServiceClient();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data, error } = await serviceClient
    .from('api_call_counter')
    .select('call_date, call_count')
    .gte('call_date', sevenDaysAgo.toISOString().split('T')[0])
    .order('call_date', { ascending: false });

  if (error) {
    // 테이블이 없을 경우 빈 데이터 반환
    if (error.code === '42P01') {
      return successResponse({
        usage: [],
        todayCount: 0,
        weeklyTotal: 0,
        dailyLimit: 10000,
      });
    }
    return ApiErrors.internalError('API 사용량 조회에 실패했습니다.', error.message);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const todayData = data?.find(d => d.call_date === todayStr);
  const weeklyTotal = data?.reduce((sum, d) => sum + d.call_count, 0) || 0;

  return successResponse({
    usage: data || [],
    todayCount: todayData?.call_count || 0,
    weeklyTotal,
    dailyLimit: 10000, // 공공데이터 일일 제한
  });
}
