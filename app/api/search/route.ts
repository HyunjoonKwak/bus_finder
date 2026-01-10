import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors, successResponse } from '@/lib/api-response';

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const ODSAY_API_KEY = process.env.ODSAY_API_KEY;

// 수도권 (서울+경기+인천) 좌표 범위
const SEOUL_METRO_BOUNDS = {
  minX: 126.5,
  maxX: 127.8,
  minY: 36.9,
  maxY: 38.0,
};

// 카카오 장소 검색 결과 타입
interface KakaoPlaceDocument {
  place_name: string;
  address_name: string;
  x: string;
  y: string;
}

interface KakaoSearchResponse {
  documents: KakaoPlaceDocument[];
}

// ODSay API 타입
interface ODSayLane {
  busNo?: string;
  busID?: string;
  name?: string;
  subwayCode?: string;
}

interface ODSaySubPath {
  trafficType: number; // 1: 지하철, 2: 버스, 3: 도보
  sectionTime?: number;
  distance?: number;
  startName?: string;
  endName?: string;
  stationCount?: number;
  lane?: ODSayLane[];
}

interface ODSayPathInfo {
  totalTime: number;
  totalDistance: number;
  payment: number;
  pathType: number;
}

interface ODSayPath {
  info: ODSayPathInfo;
  subPath: ODSaySubPath[];
}

interface ODSayResult {
  result?: {
    path?: ODSayPath[];
  };
  error?: {
    code?: number;
    message?: string;
  };
}

// 경로 Leg 타입
interface RouteLeg {
  mode: 'walk' | 'bus' | 'subway';
  duration: number;
  distance?: number;
  routeName?: string;
  routeId?: string | number;
  startName: string;
  endName: string;
  stationCount?: number;
}

// 경로 타입
interface Route {
  id: string;
  origin: { name: string };
  destination: { name: string };
  totalTime: number;
  totalDistance?: number;
  walkTime: number;
  transferCount: number;
  fare: number;
  legs: RouteLeg[];
  pathType: number;
}

// 수도권 내 좌표인지 확인
function isInSeoulMetro(lng: number, lat: number): boolean {
  return (
    lng >= SEOUL_METRO_BOUNDS.minX &&
    lng <= SEOUL_METRO_BOUNDS.maxX &&
    lat >= SEOUL_METRO_BOUNDS.minY &&
    lat <= SEOUL_METRO_BOUNDS.maxY
  );
}

// 카카오 주소 검색으로 좌표 가져오기 (수도권 우선)
async function getCoordinates(address: string): Promise<{ lat: number; lng: number; placeName: string } | null> {
  try {
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(address)}&x=126.978&y=37.5665&sort=distance`,
      {
        headers: {
          Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
        },
      }
    );

    if (!response.ok) {
      console.error('Kakao API error:', response.status);
      return null;
    }

    const data: KakaoSearchResponse = await response.json();
    if (data.documents && data.documents.length > 0) {
      const seoulMetroResult = data.documents.find((doc: KakaoPlaceDocument) => {
        const lng = parseFloat(doc.x);
        const lat = parseFloat(doc.y);
        return isInSeoulMetro(lng, lat);
      });

      const doc = seoulMetroResult || data.documents[0];
      const lng = parseFloat(doc.x);
      const lat = parseFloat(doc.y);

      if (!isInSeoulMetro(lng, lat)) {
        console.warn(`검색 결과가 수도권 외 지역입니다: ${doc.place_name} (${doc.address_name})`);
      }

      return {
        lat,
        lng,
        placeName: doc.place_name,
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

// ODSay 대중교통 경로 검색
async function searchTransitRoute(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): Promise<ODSayResult | null> {
  try {
    const url = `https://api.odsay.com/v1/api/searchPubTransPathT?SX=${startX}&SY=${startY}&EX=${endX}&EY=${endY}&apiKey=${encodeURIComponent(ODSAY_API_KEY || '')}`;

    const response = await fetch(url);
    if (!response.ok) {
      console.error('ODSay API HTTP error:', response.status);
      return null;
    }

    const data: ODSayResult = await response.json();

    if (data.error || !data.result) {
      console.error('ODSay API error:', data.error || 'No result');
      return null;
    }

    return data;
  } catch (error) {
    console.error('ODSay API error:', error);
    return null;
  }
}

// ODSay 결과를 앱 형식으로 변환
function transformODSayResult(data: ODSayResult, originName: string, destName: string): Route[] {
  if (!data?.result?.path) {
    return [];
  }

  return data.result.path.map((path: ODSayPath, index: number) => {
    const info = path.info;
    const subPaths = path.subPath || [];

    const legs: RouteLeg[] = subPaths
      .map((sub: ODSaySubPath): RouteLeg | null => {
        const trafficType = sub.trafficType;

        if (trafficType === 3) {
          return {
            mode: 'walk',
            duration: sub.sectionTime || 0,
            distance: sub.distance,
            startName: sub.startName || '출발',
            endName: sub.endName || '도착',
          };
        } else if (trafficType === 2) {
          return {
            mode: 'bus',
            duration: sub.sectionTime || 0,
            routeName: sub.lane?.[0]?.busNo || '버스',
            routeId: sub.lane?.[0]?.busID,
            startName: sub.startName || '',
            endName: sub.endName || '',
            stationCount: sub.stationCount,
          };
        } else if (trafficType === 1) {
          return {
            mode: 'subway',
            duration: sub.sectionTime || 0,
            routeName: sub.lane?.[0]?.name || '지하철',
            routeId: sub.lane?.[0]?.subwayCode,
            startName: sub.startName || '',
            endName: sub.endName || '',
            stationCount: sub.stationCount,
          };
        }
        return null;
      })
      .filter((leg): leg is RouteLeg => leg !== null);

    const walkTime = subPaths
      .filter((sub: ODSaySubPath) => sub.trafficType === 3)
      .reduce((acc: number, sub: ODSaySubPath) => acc + (sub.sectionTime || 0), 0);

    const transferCount = subPaths.filter(
      (sub: ODSaySubPath) => sub.trafficType === 1 || sub.trafficType === 2
    ).length - 1;

    return {
      id: `${index + 1}`,
      origin: { name: originName },
      destination: { name: destName },
      totalTime: info.totalTime,
      totalDistance: info.totalDistance,
      walkTime,
      transferCount: Math.max(0, transferCount),
      fare: info.payment,
      legs,
      pathType: info.pathType,
    };
  });
}

// 모의 데이터 생성
function getMockRoutes(origin: string, dest: string): Route[] {
  return [
    {
      id: '1',
      origin: { name: origin },
      destination: { name: dest },
      totalTime: 35,
      walkTime: 8,
      transferCount: 1,
      fare: 1400,
      pathType: 3,
      legs: [
        { mode: 'walk', duration: 3, startName: origin, endName: '버스정류장' },
        { mode: 'bus', duration: 20, routeName: '143', startName: '버스정류장', endName: '환승정류장' },
        { mode: 'subway', duration: 10, routeName: '2호선', startName: '환승역', endName: dest },
        { mode: 'walk', duration: 2, startName: '지하철역', endName: dest },
      ],
    },
    {
      id: '2',
      origin: { name: origin },
      destination: { name: dest },
      totalTime: 42,
      walkTime: 5,
      transferCount: 0,
      fare: 1200,
      pathType: 2,
      legs: [
        { mode: 'walk', duration: 3, startName: origin, endName: '버스정류장' },
        { mode: 'bus', duration: 37, routeName: '360', startName: '버스정류장', endName: dest },
        { mode: 'walk', duration: 2, startName: '버스정류장', endName: dest },
      ],
    },
    {
      id: '3',
      origin: { name: origin },
      destination: { name: dest },
      totalTime: 28,
      walkTime: 10,
      transferCount: 1,
      fare: 1500,
      pathType: 1,
      legs: [
        { mode: 'walk', duration: 5, startName: origin, endName: '지하철역' },
        { mode: 'subway', duration: 15, routeName: '2호선', startName: '강남역', endName: '홍대입구역' },
        { mode: 'subway', duration: 3, routeName: '경의중앙선', startName: '홍대입구역', endName: dest },
        { mode: 'walk', duration: 5, startName: '지하철역', endName: dest },
      ],
    },
  ];
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const origin = searchParams.get('origin');
  const dest = searchParams.get('dest');

  const sx = searchParams.get('sx');
  const sy = searchParams.get('sy');
  const ex = searchParams.get('ex');
  const ey = searchParams.get('ey');

  if (!origin || !dest) {
    return ApiErrors.badRequest('출발지와 도착지를 입력해주세요.');
  }

  if (!ODSAY_API_KEY) {
    return successResponse({ routes: getMockRoutes(origin, dest) });
  }

  if (!KAKAO_REST_API_KEY) {
    return successResponse({ routes: getMockRoutes(origin, dest) });
  }

  let originCoords: { lat: number; lng: number; placeName: string } | null = null;
  let destCoords: { lat: number; lng: number; placeName: string } | null = null;

  if (sx && sy) {
    const lng = parseFloat(sx);
    const lat = parseFloat(sy);
    if (!isNaN(lng) && !isNaN(lat)) {
      originCoords = { lat, lng, placeName: origin };
    }
  }

  if (ex && ey) {
    const lng = parseFloat(ex);
    const lat = parseFloat(ey);
    if (!isNaN(lng) && !isNaN(lat)) {
      destCoords = { lat, lng, placeName: dest };
    }
  }

  if (!originCoords || !destCoords) {
    const [fetchedOrigin, fetchedDest] = await Promise.all([
      originCoords ? Promise.resolve(originCoords) : getCoordinates(origin),
      destCoords ? Promise.resolve(destCoords) : getCoordinates(dest),
    ]);

    if (!originCoords) originCoords = fetchedOrigin;
    if (!destCoords) destCoords = fetchedDest;
  }

  if (!originCoords || !destCoords) {
    return successResponse({ routes: getMockRoutes(origin, dest) });
  }

  if (!isInSeoulMetro(originCoords.lng, originCoords.lat)) {
    return NextResponse.json(
      {
        error: `"${origin}"에 대한 수도권 내 검색 결과가 없습니다. 더 정확한 주소를 입력해주세요.`,
        matchedPlace: originCoords.placeName,
      },
      { status: 400 }
    );
  }

  if (!isInSeoulMetro(destCoords.lng, destCoords.lat)) {
    return NextResponse.json(
      {
        error: `"${dest}"에 대한 수도권 내 검색 결과가 없습니다. 더 정확한 주소를 입력해주세요.`,
        matchedPlace: destCoords.placeName,
      },
      { status: 400 }
    );
  }

  const odsayResult = await searchTransitRoute(
    originCoords.lng,
    originCoords.lat,
    destCoords.lng,
    destCoords.lat
  );

  if (!odsayResult) {
    return successResponse({ routes: getMockRoutes(origin, dest) });
  }

  const routes = transformODSayResult(odsayResult, originCoords.placeName, destCoords.placeName);

  if (routes.length === 0) {
    return successResponse({ routes: getMockRoutes(origin, dest) });
  }

  return successResponse({
    routes,
    matchedOrigin: originCoords.placeName,
    matchedDest: destCoords.placeName,
  });
}
