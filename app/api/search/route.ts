import { NextRequest, NextResponse } from 'next/server';
import { ApiErrors, successResponse } from '@/lib/api-response';
import {
  isInSeoulMetro,
  getCoordinates,
  searchTransitRoute,
  transformODSayResult,
  getMockRoutes,
} from '@/lib/odsay/search-utils';

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const ODSAY_API_KEY = process.env.ODSAY_API_KEY;

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

  const routes = transformODSayResult(
    odsayResult,
    originCoords.placeName,
    destCoords.placeName,
    originCoords,
    destCoords
  );

  if (routes.length === 0) {
    return successResponse({ routes: getMockRoutes(origin, dest) });
  }

  return successResponse({
    routes,
    matchedOrigin: originCoords.placeName,
    matchedDest: destCoords.placeName,
  });
}
