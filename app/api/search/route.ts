import { NextRequest, NextResponse } from 'next/server';

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const ODSAY_API_KEY = process.env.ODSAY_API_KEY; // ODSay 전용 키

// 수도권 (서울+경기+인천) 좌표 범위
// 서울/경기/인천 대략적인 경계: x(경도) 126.5~127.8, y(위도) 36.9~38.0
const SEOUL_METRO_BOUNDS = {
  minX: 126.5,
  maxX: 127.8,
  minY: 36.9,
  maxY: 38.0,
};

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
    // 수도권 중심 좌표 (서울시청 기준)로 검색 - radius 제거 (최대 20000m 제한)
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

    const data = await response.json();
    if (data.documents && data.documents.length > 0) {
      // 수도권 내 결과 우선 선택
      const seoulMetroResult = data.documents.find((doc: any) => {
        const lng = parseFloat(doc.x);
        const lat = parseFloat(doc.y);
        return isInSeoulMetro(lng, lat);
      });

      const doc = seoulMetroResult || data.documents[0];
      const lng = parseFloat(doc.x);
      const lat = parseFloat(doc.y);

      // 수도권 외 결과인 경우 경고 로그
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

  // 직접 좌표가 전달된 경우
  const sx = searchParams.get('sx');
  const sy = searchParams.get('sy');
  const ex = searchParams.get('ex');
  const ey = searchParams.get('ey');

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

  let originCoords: { lat: number; lng: number; placeName: string } | null = null;
  let destCoords: { lat: number; lng: number; placeName: string } | null = null;

  // 직접 좌표가 전달된 경우 사용
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

  // 좌표가 없으면 지오코딩으로 가져오기
  if (!originCoords || !destCoords) {
    const [fetchedOrigin, fetchedDest] = await Promise.all([
      originCoords ? Promise.resolve(originCoords) : getCoordinates(origin),
      destCoords ? Promise.resolve(destCoords) : getCoordinates(dest),
    ]);

    if (!originCoords) originCoords = fetchedOrigin;
    if (!destCoords) destCoords = fetchedDest;
  }

  if (!originCoords || !destCoords) {
    console.log('Could not get coordinates, returning mock data');
    return NextResponse.json({ routes: getMockRoutes(origin, dest) });
  }

  // 수도권 외 검색 결과인 경우 에러 반환
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

  console.log(`검색: ${originCoords.placeName} → ${destCoords.placeName}`);

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

  // 결과 변환 - 실제 매칭된 장소 이름 사용
  const routes = transformODSayResult(odsayResult, originCoords.placeName, destCoords.placeName);

  if (routes.length === 0) {
    return NextResponse.json({ routes: getMockRoutes(origin, dest) });
  }

  return NextResponse.json({
    routes,
    matchedOrigin: originCoords.placeName,
    matchedDest: destCoords.placeName,
  });
}
