import { NextRequest, NextResponse } from 'next/server';

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;

// 수도권 (서울+경기+인천) 좌표 범위
const SEOUL_METRO_BOUNDS = {
  minX: 126.5,
  maxX: 127.8,
  minY: 36.9,
  maxY: 38.0,
};

function isInSeoulMetro(lng: number, lat: number): boolean {
  return (
    lng >= SEOUL_METRO_BOUNDS.minX &&
    lng <= SEOUL_METRO_BOUNDS.maxX &&
    lat >= SEOUL_METRO_BOUNDS.minY &&
    lat <= SEOUL_METRO_BOUNDS.maxY
  );
}

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  category: string;
  x: string;
  y: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('query');

  if (!query || query.length < 2) {
    return NextResponse.json({ places: [] });
  }

  if (!KAKAO_REST_API_KEY) {
    return NextResponse.json(
      { error: 'Kakao API key not configured' },
      { status: 500 }
    );
  }

  try {
    // 수도권 중심 좌표 (서울시청)로 검색 - radius 제거 (최대 20000m 제한 있음)
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&x=126.978&y=37.5665&size=15`;

    const response = await fetch(url, {
      headers: {
        Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.error('Kakao API error:', response.status);
      return NextResponse.json({ places: [] });
    }

    const data = await response.json();

    if (!data.documents || data.documents.length === 0) {
      return NextResponse.json({ places: [] });
    }

    // 수도권 내 결과만 필터링하고 변환
    const places: PlaceResult[] = data.documents
      .filter((doc: any) => {
        const lng = parseFloat(doc.x);
        const lat = parseFloat(doc.y);
        return isInSeoulMetro(lng, lat);
      })
      .map((doc: any) => ({
        id: doc.id,
        name: doc.place_name,
        address: doc.address_name,
        roadAddress: doc.road_address_name || doc.address_name,
        category: doc.category_group_name || doc.category_name?.split(' > ').pop() || '',
        x: doc.x,
        y: doc.y,
      }));

    return NextResponse.json({ places });
  } catch (error) {
    console.error('Place search error:', error);
    return NextResponse.json({ places: [] });
  }
}
