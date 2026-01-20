/**
 * API 호출 카운터 유틸리티
 * 공공데이터 API 호출 횟수를 추적합니다.
 */

import { createServiceClient } from '@/lib/supabase/service';

let serviceClient: ReturnType<typeof createServiceClient> | null = null;

function getServiceClient() {
  if (!serviceClient) {
    try {
      serviceClient = createServiceClient();
    } catch {
      // 서비스 클라이언트 생성 실패 시 null 반환
      return null;
    }
  }
  return serviceClient;
}

/**
 * API 호출 카운트 증가
 * 데이터베이스의 increment_api_call_count() 함수를 호출합니다.
 */
export async function incrementApiCallCount(): Promise<number | null> {
  const client = getServiceClient();
  if (!client) return null;

  try {
    const { data, error } = await client.rpc('increment_api_call_count');

    if (error) {
      console.error('[API Counter] Increment error:', error.message);
      return null;
    }

    return data as number;
  } catch (error) {
    console.error('[API Counter] Error:', error);
    return null;
  }
}

/**
 * 오늘의 API 호출 횟수 조회
 */
export async function getTodayApiCalls(): Promise<number> {
  const client = getServiceClient();
  if (!client) return 0;

  try {
    const { data, error } = await client.rpc('get_today_api_calls');

    if (error) {
      console.error('[API Counter] Get today calls error:', error.message);
      return 0;
    }

    return (data as number) || 0;
  } catch (error) {
    console.error('[API Counter] Error:', error);
    return 0;
  }
}
