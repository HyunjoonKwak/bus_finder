import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 탑승 기록 조회
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('transport_history')
    .select('*')
    .eq('user_id', user.id)
    .order('boarded_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ history: data });
}

// 탑승 기록 생성
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json();
  const { origin_name, dest_name, route_data, total_time } = body;

  if (!origin_name || !dest_name) {
    return NextResponse.json(
      { error: '출발지와 도착지를 입력해주세요.' },
      { status: 400 }
    );
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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ history: data });
}
