import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 즐겨찾기 노선 조회
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('favorite_routes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ routes: data });
}

// 즐겨찾기 노선 추가
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json();
  const { bus_id, bus_no, bus_type } = body;

  if (!bus_id || !bus_no) {
    return NextResponse.json(
      { error: '버스 정보가 필요합니다.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('favorite_routes')
    .insert({
      user_id: user.id,
      bus_id,
      bus_no,
      bus_type: bus_type || null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: '이미 즐겨찾기에 추가된 노선입니다.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ route: data });
}

// 즐겨찾기 노선 삭제
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const busId = searchParams.get('busId');

  if (!busId) {
    return NextResponse.json(
      { error: '버스 ID가 필요합니다.' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('favorite_routes')
    .delete()
    .eq('bus_id', busId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
