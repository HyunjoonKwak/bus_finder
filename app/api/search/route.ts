import { NextRequest, NextResponse } from 'next/server';

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const ODSAY_API_KEY = process.env.ODSAY_API_KEY; // ODSay 전용 키

// 카카오 주소 검색으로 좌표 가져오기
async function getCoordinates(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(address)}`,
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

    const data = await response.json();
    if (data.documents && data.documents.length > 0) {
      const doc = data.documents[0];
      return {
        lat: parseFloat(doc.y),
        lng: parseFloat(doc.x),
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
) {
  try {
    const url = `https://api.odsay.com/v1/api/searchPubTransPathT?SX=${startX}&SY=${startY}&EX=${endX}&EY=${endY}&apiKey=${encodeURIComponent(ODSAY_API_KEY || '')}`;

    console.log('ODSay API request:', url.replace(ODSAY_API_KEY || '', '***'));

    const response = await fetch(url);
    const data = await response.json();

    console.log('ODSay API response:', JSON.stringify(data).substring(0, 200));

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
function transformODSayResult(data: any, originName: string, destName: string) {
  if (!data?.result?.path) {
    return [];
  }

  return data.result.path.map((path: any, index: number) => {
    const info = path.info;
    const subPaths = path.subPath || [];

    // legs 변환
    const legs = subPaths.map((sub: any) => {
      const trafficType = sub.trafficType; // 1: 지하철, 2: 버스, 3: 도보

      if (trafficType === 3) {
        return {
          mode: 'walk',
          duration: sub.sectionTime,
          distance: sub.distance,
          startName: sub.startName || '출발',
          endName: sub.endName || '도착',
        };
      } else if (trafficType === 2) {
        return {
          mode: 'bus',
          duration: sub.sectionTime,
          routeName: sub.lane?.[0]?.busNo || '버스',
          routeId: sub.lane?.[0]?.busID,
          startName: sub.startName,
          endName: sub.endName,
          stationCount: sub.stationCount,
        };
      } else if (trafficType === 1) {
        return {
          mode: 'subway',
          duration: sub.sectionTime,
          routeName: sub.lane?.[0]?.name || '지하철',
          routeId: sub.lane?.[0]?.subwayCode,
          startName: sub.startName,
          endName: sub.endName,
          stationCount: sub.stationCount,
        };
      }
      return null;
    }).filter(Boolean);

    // 도보 시간 계산
    const walkTime = subPaths
      .filter((sub: any) => sub.trafficType === 3)
      .reduce((acc: number, sub: any) => acc + (sub.sectionTime || 0), 0);

    // 환승 횟수 계산
    const transferCount = subPaths.filter(
      (sub: any) => sub.trafficType === 1 || sub.trafficType === 2
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
      pathType: info.pathType, // 1: 지하철, 2: 버스, 3: 버스+지하철
    };
  });
}

// 모의 데이터 생성
function getMockRoutes(origin: string, dest: string) {
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

  if (!origin || !dest) {
    return NextResponse.json(
      { error: '출발지와 도착지를 입력해주세요.' },
      { status: 400 }
    );
  }

  // ODSay API 키가 없으면 모의 데이터 반환
  if (!ODSAY_API_KEY) {
    console.log('ODSay API key not configured, returning mock data');
    return NextResponse.json({ routes: getMockRoutes(origin, dest) });
  }

  // 카카오 REST API 키가 없으면 모의 데이터 반환
  if (!KAKAO_REST_API_KEY) {
    console.log('Kakao REST API key not configured, returning mock data');
    return NextResponse.json({ routes: getMockRoutes(origin, dest) });
  }

  // 출발지/도착지 좌표 가져오기
  const [originCoords, destCoords] = await Promise.all([
    getCoordinates(origin),
    getCoordinates(dest),
  ]);

  if (!originCoords || !destCoords) {
    console.log('Could not get coordinates, returning mock data');
    return NextResponse.json({ routes: getMockRoutes(origin, dest) });
  }

  // ODSay 경로 검색
  const odsayResult = await searchTransitRoute(
    originCoords.lng,
    originCoords.lat,
    destCoords.lng,
    destCoords.lat
  );

  if (!odsayResult) {
    console.log('ODSay search failed, returning mock data');
    return NextResponse.json({ routes: getMockRoutes(origin, dest) });
  }

  // 결과 변환
  const routes = transformODSayResult(odsayResult, origin, dest);

  if (routes.length === 0) {
    return NextResponse.json({ routes: getMockRoutes(origin, dest) });
  }

  return NextResponse.json({ routes });
}
