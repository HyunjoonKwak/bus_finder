import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ history: [] });
    }

    const { data, error } = await supabase
      .from('route_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Route history fetch error:', error);
      return NextResponse.json({ history: [] });
    }

    return NextResponse.json({ history: data || [] });
  } catch (error) {
    console.error('Route history error:', error);
    return NextResponse.json({ history: [] });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    const body = await request.json();
    const { originName, originAddress, originX, originY, destName, destAddress, destX, destY } = body;

    if (!originName || !originX || !originY || !destName || !destX || !destY) {
      return NextResponse.json({ error: '필수 정보가 누락되었습니다.' }, { status: 400 });
    }

    // 중복 방지: 같은 출발지/도착지가 최근 1분 내에 있으면 저장하지 않음
    const { data: recent } = await supabase
      .from('route_history')
      .select('id')
      .eq('user_id', user.id)
      .eq('origin_x', originX)
      .eq('origin_y', originY)
      .eq('dest_x', destX)
      .eq('dest_y', destY)
      .gte('created_at', new Date(Date.now() - 60000).toISOString())
      .limit(1);

    if (recent && recent.length > 0) {
      return NextResponse.json({ success: true, message: '이미 최근에 저장됨' });
    }

    const { data, error } = await supabase
      .from('route_history')
      .insert({
        user_id: user.id,
        origin_name: originName,
        origin_address: originAddress || null,
        origin_x: originX,
        origin_y: originY,
        dest_name: destName,
        dest_address: destAddress || null,
        dest_x: destX,
        dest_y: destY,
      })
      .select()
      .single();

    if (error) {
      console.error('Route history insert error:', error);
      return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, history: data });
  } catch (error) {
    console.error('Route history error:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
