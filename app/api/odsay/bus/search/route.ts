import { NextRequest, NextResponse } from 'next/server';
import { searchBusLane } from '@/lib/odsay';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json(
      { error: '버스 번호를 입력해주세요.' },
      { status: 400 }
    );
  }

  try {
    const buses = await searchBusLane(query);
    return NextResponse.json({ buses });
  } catch (error) {
    console.error('Bus search error:', error);
    return NextResponse.json(
      { error: '버스 검색에 실패했습니다.' },
      { status: 500 }
    );
  }
}
