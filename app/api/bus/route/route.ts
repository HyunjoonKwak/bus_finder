import { NextRequest, NextResponse } from 'next/server';
import { getBusRouteDetail } from '@/lib/publicdata/bus-route';
import { getBusLaneDetail } from '@/lib/odsay';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const routeId = searchParams.get('routeId') || '';
  const busNo = searchParams.get('busNo') || '';

  if (!routeId && !busNo) {
    return NextResponse.json(
      { error: '노선 ID 또는 버스 번호가 필요합니다.' },
      { status: 400 }
    );
  }

  try {
    // 공공데이터 API로 먼저 시도
    const { routeInfo, stations, busPositions } = await getBusRouteDetail(routeId, busNo);

    // 공공데이터 API에서 정보를 가져왔으면 반환
    if (stations.length > 0) {
      return NextResponse.json({
        routeInfo: routeInfo ? {
          routeId: routeInfo.routeId,
          routeName: routeInfo.routeName,
          routeType: routeInfo.routeType,
          startStation: routeInfo.startStation,
          endStation: routeInfo.endStation,
          firstTime: routeInfo.firstTime,
          lastTime: routeInfo.lastTime,
          interval: routeInfo.interval,
          companyName: routeInfo.companyName,
        } : null,
        stations: stations.map((s, idx) => ({
          stationID: s.stationId,
          stationName: s.stationName,
          arsID: s.stationNo,
          idx: s.sequence || idx + 1,
          x: s.x,
          y: s.y,
        })),
        realtime: busPositions.map((p) => ({
          busStationSeq: p.stationSeq,
          plateNo: p.plateNo,
          lowPlate: p.lowPlate,
          crowded: p.crowded,
          direction: p.direction, // 0=상행(기점→종점), 1=하행(종점→기점)
        })),
      });
    }

    // 공공데이터 API 실패 시 ODSay API 폴백
    if (routeId) {
      const odsayResult = await getBusLaneDetail(routeId);
      if (odsayResult.stations.length > 0) {
        return NextResponse.json({
          routeInfo: odsayResult.lane?.[0] ? {
            routeId,
            routeName: odsayResult.lane[0].busNo,
            startStation: odsayResult.lane[0].busStartPoint,
            endStation: odsayResult.lane[0].busEndPoint,
            firstTime: odsayResult.lane[0].busFirstTime,
            lastTime: odsayResult.lane[0].busLastTime,
            interval: odsayResult.lane[0].busInterval,
          } : null,
          stations: odsayResult.stations,
          // ODSay realtime 형식을 공공데이터 API 형식과 통일
          // ODSay: busDirection (1=정방향/기점→종점, 2=역방향/종점→기점)
          // 공공데이터: direction (0=상행/기점→종점, 1=하행/종점→기점)
          realtime: odsayResult.realtime.map((bus) => ({
            busStationSeq: bus.busStationSeq,
            plateNo: bus.busPlateNo,
            lowPlate: false,
            crowded: undefined,
            direction: bus.busDirection === 1 ? 0 : bus.busDirection === 2 ? 1 : undefined,
          })),
        });
      }
    }

    // 모든 API 실패
    return NextResponse.json({
      routeInfo: busNo ? { routeId, routeName: busNo } : null,
      stations: [],
      realtime: [],
    });
  } catch (error) {
    console.error('Bus route API error:', error);
    return NextResponse.json(
      { error: '버스 노선 정보 조회에 실패했습니다.' },
      { status: 500 }
    );
  }
}
