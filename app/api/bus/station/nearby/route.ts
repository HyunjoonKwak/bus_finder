import { NextRequest } from 'next/server';
import { searchNearbyStations } from '@/lib/publicdata/bus-station';
import { ApiErrors, successResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const x = searchParams.get('x'); // 경도
  const y = searchParams.get('y'); // 위도
  const radius = searchParams.get('radius') || '500';

  if (!x || !y) {
    return ApiErrors.badRequest('위치 정보가 필요합니다.');
  }

  try {
    const stations = await searchNearbyStations(
      parseFloat(x),
      parseFloat(y),
      parseInt(radius)
    );

    // 프론트엔드 형식에 맞게 변환
    const formattedStations = stations.map((s) => ({
      stationID: s.stationId,
      stationName: s.stationName,
      arsID: s.arsId,
      x: s.x,
      y: s.y,
      distance: s.distance || 0,
    }));

    return successResponse({ stations: formattedStations });
  } catch (error) {
    console.error('Nearby stations error:', error);
    return ApiErrors.internalError('주변 정류소 검색에 실패했습니다.');
  }
}
