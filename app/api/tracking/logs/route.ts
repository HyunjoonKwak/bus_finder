import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: 버스 도착 로그 조회
export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
    console.error('Arrival logs fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ logs: data });
}

// POST: 버스 도착 로그 추가
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { bus_id, bus_no, station_id, station_name, arrival_time } = body;

  if (!bus_id || !bus_no || !station_id || !station_name) {
    return NextResponse.json(
      { error: 'bus_id, bus_no, station_id, station_name are required' },
      { status: 400 }
    );
  }

  const arrivalDate = arrival_time ? new Date(arrival_time) : new Date();
  const dayOfWeek = arrivalDate.getDay(); // 0=일, 1=월, ..., 6=토

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
    })
    .select()
    .single();

  if (error) {
    console.error('Arrival log insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ log: data });
}

// DELETE: 버스 도착 로그 삭제
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
    .from('bus_arrival_logs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Arrival log delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
