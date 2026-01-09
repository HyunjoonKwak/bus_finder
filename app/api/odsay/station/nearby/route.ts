import { NextRequest, NextResponse } from 'next/server';
import { searchNearbyStations } from '@/lib/odsay';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const x = searchParams.get('x'); // 경도
  const y = searchParams.get('y'); // 위도
  const radius = searchParams.get('radius') || '500';

  if (!x || !y) {
    return NextResponse.json(
      { error: '위치 정보가 필요합니다.' },
      { status: 400 }
    );
  }

  try {
    const stations = await searchNearbyStations(
      parseFloat(x),
      parseFloat(y),
      parseInt(radius)
    );
    return NextResponse.json({ stations });
  } catch (error) {
    console.error('Nearby stations error:', error);
    return NextResponse.json(
      { error: '주변 정류소 검색에 실패했습니다.' },
      { status: 500 }
    );
  }
}
