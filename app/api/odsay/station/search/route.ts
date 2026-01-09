import { NextRequest, NextResponse } from 'next/server';
import { searchStation } from '@/lib/odsay';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json(
      { error: '검색어를 입력해주세요.' },
      { status: 400 }
    );
  }

  try {
    const stations = await searchStation(query);
    return NextResponse.json({ stations });
  } catch (error) {
    console.error('Station search error:', error);
    return NextResponse.json(
      { error: '정류소 검색에 실패했습니다.' },
      { status: 500 }
    );
  }
}
