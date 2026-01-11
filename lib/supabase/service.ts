import { createClient } from '@supabase/supabase-js';

/**
 * 서버 Cron 작업용 Supabase 클라이언트
 * service_role 키를 사용하여 RLS를 우회합니다.
 * 주의: 이 클라이언트는 서버 사이드에서만 사용해야 합니다.
 *
 * 환경변수:
 * - SUPABASE_SERVICE_ROLE_KEY: Supabase 대시보드 > Settings > API > service_role
 */
export function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!serviceRoleKey) {
    console.warn(
      '[Supabase] SUPABASE_SERVICE_ROLE_KEY not found. ' +
      'Get it from: Supabase Dashboard > Settings > API > service_role (secret)'
    );
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY. ' +
      'Add it to .env.local from Supabase Dashboard > Settings > API'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
