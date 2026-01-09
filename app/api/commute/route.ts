import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET: 출퇴근 경로 목록 조회
export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('commute_routes')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Commute routes fetch error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ routes: data });
}

// POST: 출퇴근 경로 추가
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { name, origin_name, origin_x, origin_y, dest_name, dest_x, dest_y } =
    body;

  if (!name || !origin_name || !dest_name) {
    return NextResponse.json(
      { error: 'name, origin_name, dest_name are required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('commute_routes')
    .insert({
      user_id: user.id,
      name,
      origin_name,
      origin_x,
      origin_y,
      dest_name,
      dest_x,
      dest_y,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Commute route insert error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ route: data });
}

// DELETE: 출퇴근 경로 삭제
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
    .from('commute_routes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Commute route delete error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// PATCH: 출퇴근 경로 활성화/비활성화
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
    .from('commute_routes')
    .update({ is_active })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Commute route update error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ route: data });
}
