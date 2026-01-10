import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: 버스 추적 대상 목록 조회
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('bus_tracking_targets')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Tracking targets fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ targets: data });
}

// POST: 버스 추적 대상 추가
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { bus_id, bus_no, station_id, station_name, ars_id } = body;

  if (!bus_id || !bus_no || !station_id || !station_name) {
    return NextResponse.json(
      { error: 'bus_id, bus_no, station_id, station_name are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('bus_tracking_targets')
    .insert({
      user_id: user.id,
      bus_id,
      bus_no,
      station_id,
      station_name,
      ars_id: ars_id || null, // 정류소 고유번호 (서울시/경기도 API 조회용)
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    // 중복 추가 시도 시
    if (error.code === '23505') {
      return NextResponse.json(
        { error: '이미 추적 중인 버스+정류소 조합입니다.' },
        { status: 409 }
      );
    }
    console.error('Tracking target insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ target: data });
}

// DELETE: 버스 추적 대상 삭제
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('bus_tracking_targets')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Tracking target delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH: 버스 추적 대상 활성화/비활성화
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { id, is_active } = body;

  if (!id || typeof is_active !== 'boolean') {
    return NextResponse.json(
      { error: 'id and is_active are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('bus_tracking_targets')
    .update({ is_active })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Tracking target update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ target: data });
}
