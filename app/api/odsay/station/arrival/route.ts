import { NextRequest, NextResponse } from 'next/server';
import { getRealtimeArrival } from '@/lib/odsay';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const stationId = searchParams.get('stationId');

  if (!stationId) {
    return NextResponse.json(
      { error: '정류소 ID가 필요합니다.' },
      { status: 400 }
    );
  }

  try {
    const arrivals = await getRealtimeArrival(stationId);
    return NextResponse.json({ arrivals });
  } catch (error) {
    console.error('Arrival info error:', error);
    return NextResponse.json(
      { error: '도착 정보 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
