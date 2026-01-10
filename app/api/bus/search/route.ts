import { NextRequest, NextResponse } from 'next/server';
import { searchGyeonggiBusRoute, searchSeoulBusRoute, BusRouteInfo } from '@/lib/publicdata/bus-route';
import { searchBusLane } from '@/lib/odsay';

// 버스 타입 매핑 (routeType 문자열 → 경기도 도착정보 API routeTypeCd)
// 경기도 도착정보 API 기준 (routeTypeCd):
// 11:직행좌석형, 12:좌석형, 13:일반형, 14:광역급행형, 15:따복형, 16:경기순환
// 21:직행좌석형농어촌, 22:좌석형농어촌, 23:일반형농어촌, 30:마을버스
// 41:고속형시외, 42:좌석형시외, 43:일반형시외, 51:리무진공항, 52:좌석형공항, 53:일반형공항
function getBusType(routeType?: string): number {
  if (!routeType) return 13; // 기본값: 일반형

  const typeMap: Record<string, number> = {
    // 경기도 버스 (노선검색 API routeTypeName → 도착정보 API routeTypeCd)
    '직행좌석': 11,
    '좌석': 12,
    '일반': 13,
    '광역급행': 14,
    '따복': 15,
    '경기순환': 16,
    '마을버스': 30,
    '마을': 30,
    // 시외버스
    '고속': 41,
    '시외': 42,
    // 공항버스
    '리무진': 51,
    '공항': 52,
    // 서울 버스 (서울시 API routeType → 경기도 코드로 변환)
    '간선': 6,    // 서울 간선 (파랑)
    '지선': 1,    // 서울 지선 (초록)
    '순환': 1,    // 서울 순환 → 지선으로 처리
    '광역': 4,    // 서울 광역 (빨강)
  };

  for (const [key, value] of Object.entries(typeMap)) {
    if (routeType.includes(key)) return value;
  }
  return 13; // 기본값: 일반형
}

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
    // 공공데이터포털 API 동시 검색 (경기도 + 서울)
    const [gyeonggiBuses, seoulBuses] = await Promise.all([
      searchGyeonggiBusRoute(query),
      searchSeoulBusRoute(query),
    ]);

    // 중복 제거를 위한 Set (버스번호 기준)
    const seenBusNos = new Set<string>();
    const allBuses: BusRouteInfo[] = [];

    // 경기도 결과 먼저 추가
    for (const bus of gyeonggiBuses) {
      if (!seenBusNos.has(bus.routeName)) {
        seenBusNos.add(bus.routeName);
        allBuses.push(bus);
      }
    }

    // 서울 결과 추가 (중복 제외)
    for (const bus of seoulBuses) {
      if (!seenBusNos.has(bus.routeName)) {
        seenBusNos.add(bus.routeName);
        allBuses.push(bus);
      }
    }

    // 공공데이터포털에서 결과가 없으면 ODSay 폴백
    if (allBuses.length === 0) {
      const odsayBuses = await searchBusLane(query);
      if (odsayBuses.length > 0) {
        const formattedOdsayBuses = odsayBuses.map((bus) => ({
          busID: String(bus.busID),
          busNo: bus.busNo,
          type: bus.type || 11,
          busStartPoint: bus.busStartPoint,
          busEndPoint: bus.busEndPoint,
          busFirstTime: bus.busFirstTime,
          busLastTime: bus.busLastTime,
        }));
        return NextResponse.json({ buses: formattedOdsayBuses });
      }
    }

    // ODSay 형식과 호환되도록 변환
    const formattedBuses = allBuses.map((bus) => ({
      busID: bus.routeId,
      busNo: bus.routeName,
      type: getBusType(bus.routeType),
      busStartPoint: bus.startStation,
      busEndPoint: bus.endStation,
      busFirstTime: bus.firstTime,
      busLastTime: bus.lastTime,
    }));

    return NextResponse.json({ buses: formattedBuses });
  } catch (error) {
    console.error('Bus search error:', error);
    return NextResponse.json(
      { error: '버스 검색에 실패했습니다.' },
      { status: 500 }
    );
  }
}
