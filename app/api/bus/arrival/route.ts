import { NextRequest, NextResponse } from 'next/server';
import { getBusArrival } from '@/lib/publicdata/bus-arrival';
import { getRealtimeArrival } from '@/lib/odsay';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const stationId = searchParams.get('stationId');
  const arsId = searchParams.get('arsId');

  if (!stationId && !arsId) {
    return NextResponse.json(
      { error: '정류소 ID 또는 정류소 번호가 필요합니다.' },
      { status: 400 }
    );
  }

  try {
    let arrivals: any[] = [];

    // 공공데이터 API 먼저 시도 (서울시/경기도 자동 판단)
    if (arsId || stationId) {
      arrivals = await getBusArrival(stationId || '', arsId || undefined);
    }

    // 공공데이터 API 결과가 없으면 ODSay API 폴백
    if (arrivals.length === 0 && stationId) {
      const odsayArrivals = await getRealtimeArrival(stationId);

      // ODSay 응답 형식 변환
      arrivals = odsayArrivals.flatMap((item) => {
        const result = [];

        if (item.arrival1?.arrivalSec) {
          result.push({
            routeName: item.routeNm,
            routeId: item.routeID,
            predictTime1: Math.floor(item.arrival1.arrivalSec / 60),
            predictTimeSec1: item.arrival1.arrivalSec,
            direction: item.arrival1.busPosition,
          });
        }

        return result;
      });

      // 도착 시간순 정렬
      arrivals.sort((a, b) => (a.predictTimeSec1 || 0) - (b.predictTimeSec1 || 0));
    }

    return NextResponse.json({ arrivals });
  } catch (error) {
    console.error('Bus arrival API error:', error);
    return NextResponse.json(
      { error: '도착 정보 조회에 실패했습니다.', detail: String(error) },
      { status: 500 }
    );
  }
}
