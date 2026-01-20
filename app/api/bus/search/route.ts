import { NextRequest } from 'next/server';
import { searchGyeonggiBusRoute, searchSeoulBusRoute, BusRouteInfo } from '@/lib/publicdata/bus-route';
import { searchBusLane } from '@/lib/odsay';
import { ApiErrors, successResponse } from '@/lib/api-response';

// 버스 타입 매핑 (routeType 문자열 → 경기도 도착정보 API routeTypeCd)
function getBusType(routeType?: string): number {
  if (!routeType) return 13; // 기본값: 일반형

  const typeMap: Record<string, number> = {
    '직행좌석': 11,
    '좌석': 12,
    '일반': 13,
    '광역급행': 14,
    '따복': 15,
    '경기순환': 16,
    '마을버스': 30,
    '마을': 30,
    '고속': 41,
    '시외': 42,
    '리무진': 51,
    '공항': 52,
    '간선': 6,
    '지선': 1,
    '순환': 1,
    '광역': 4,
  };

  for (const [key, value] of Object.entries(typeMap)) {
    if (routeType.includes(key)) return value;
  }
  return 13;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q');

  if (!query) {
    return ApiErrors.badRequest('버스 번호를 입력해주세요.');
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
        return successResponse({ buses: formattedOdsayBuses });
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

    return successResponse({ buses: formattedBuses });
  } catch (error) {
    console.error('Bus search error:', error);
    return ApiErrors.internalError('버스 검색에 실패했습니다.');
  }
}
