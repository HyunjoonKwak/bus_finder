import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 즐겨찾기 정류소 조회
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('favorite_stations')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ stations: data });
}

// 즐겨찾기 정류소 추가
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const body = await request.json();
  const { station_id, station_name, x, y } = body;

  if (!station_id || !station_name) {
    return NextResponse.json(
      { error: '정류소 정보가 필요합니다.' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('favorite_stations')
    .insert({
      user_id: user.id,
      station_id,
      station_name,
      x,
      y,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json(
        { error: '이미 즐겨찾기에 추가된 정류소입니다.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ station: data });
}

// 즐겨찾기 정류소 삭제
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const stationId = searchParams.get('stationId');

  if (!stationId) {
    return NextResponse.json(
      { error: '정류소 ID가 필요합니다.' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('favorite_stations')
    .delete()
    .eq('station_id', stationId)
    .eq('user_id', user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
