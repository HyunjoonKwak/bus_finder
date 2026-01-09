import { NextRequest, NextResponse } from 'next/server';
import { getBusLaneDetail } from '@/lib/odsay';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const busId = searchParams.get('busId');

  if (!busId) {
    return NextResponse.json(
      { error: '버스 ID가 필요합니다.' },
      { status: 400 }
    );
  }

  try {
    const detail = await getBusLaneDetail(busId);
    return NextResponse.json(detail);
  } catch (error) {
    console.error('Bus location error:', error);
    return NextResponse.json(
      { error: '버스 위치 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
