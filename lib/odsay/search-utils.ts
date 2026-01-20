/**
 * ODSay 경로 검색 유틸리티 함수
 */

import {
  SEOUL_METRO_BOUNDS,
  KakaoSearchResponse,
  KakaoPlaceDocument,
  ODSayResult,
  ODSayPath,
  ODSaySubPath,
  Coordinate,
  RouteLeg,
  Route,
  CoordinateResult,
} from './search-types';

const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY;
const ODSAY_API_KEY = process.env.ODSAY_API_KEY;

/**
 * 수도권 내 좌표인지 확인
 */
export function isInSeoulMetro(lng: number, lat: number): boolean {
  return (
    lng >= SEOUL_METRO_BOUNDS.minX &&
    lng <= SEOUL_METRO_BOUNDS.maxX &&
    lat >= SEOUL_METRO_BOUNDS.minY &&
    lat <= SEOUL_METRO_BOUNDS.maxY
  );
}

/**
 * 카카오 주소 검색으로 좌표 가져오기 (수도권 우선)
 */
export async function getCoordinates(address: string): Promise<CoordinateResult | null> {
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

/**
 * ODSay 대중교통 경로 검색
 */
export async function searchTransitRoute(
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

/**
 * ODSay 결과를 앱 형식으로 변환
 */
export function transformODSayResult(
  data: ODSayResult,
  originName: string,
  destName: string,
  originCoords: { lat: number; lng: number },
  destCoords: { lat: number; lng: number }
): Route[] {
  if (!data?.result?.path) {
    return [];
  }

  return data.result.path.map((path: ODSayPath, index: number) => {
    const info = path.info;
    const subPaths = path.subPath || [];

    // 먼저 모든 subPath를 RouteLeg로 변환
    const legs: RouteLeg[] = subPaths
      .map((sub: ODSaySubPath, subIndex: number): RouteLeg | null => {
        const trafficType = sub.trafficType;

        // 경유 좌표 추출
        const passCoords: Coordinate[] = [];
        if (sub.passStopList?.stations) {
          for (const station of sub.passStopList.stations) {
            if (station.x && station.y) {
              passCoords.push({
                x: parseFloat(station.x),
                y: parseFloat(station.y),
              });
            }
          }
        }

        // 시작/끝 좌표 (버스/지하철은 직접 제공, 도보는 인접 구간에서 추론)
        let start = sub.startX && sub.startY ? { x: sub.startX, y: sub.startY } : undefined;
        let end = sub.endX && sub.endY ? { x: sub.endX, y: sub.endY } : undefined;

        // 도보 구간의 좌표 추론
        if (trafficType === 3 && (!start || !end)) {
          // 이전 구간의 끝점을 시작점으로
          if (!start && subIndex > 0) {
            const prevSub = subPaths[subIndex - 1];
            if (prevSub.endX && prevSub.endY) {
              start = { x: prevSub.endX, y: prevSub.endY };
            } else if (prevSub.passStopList?.stations?.length) {
              const lastStation = prevSub.passStopList.stations[prevSub.passStopList.stations.length - 1];
              if (lastStation.x && lastStation.y) {
                start = { x: parseFloat(lastStation.x), y: parseFloat(lastStation.y) };
              }
            }
          }
          // 첫 번째 도보 구간이면 출발지 좌표 사용
          if (!start && subIndex === 0) {
            start = { x: originCoords.lng, y: originCoords.lat };
          }

          // 다음 구간의 시작점을 끝점으로
          if (!end && subIndex < subPaths.length - 1) {
            const nextSub = subPaths[subIndex + 1];
            if (nextSub.startX && nextSub.startY) {
              end = { x: nextSub.startX, y: nextSub.startY };
            } else if (nextSub.passStopList?.stations?.length) {
              const firstStation = nextSub.passStopList.stations[0];
              if (firstStation.x && firstStation.y) {
                end = { x: parseFloat(firstStation.x), y: parseFloat(firstStation.y) };
              }
            }
          }
          // 마지막 도보 구간이면 도착지 좌표 사용
          if (!end && subIndex === subPaths.length - 1) {
            end = { x: destCoords.lng, y: destCoords.lat };
          }
        }

        if (trafficType === 3) {
          return {
            mode: 'walk',
            duration: sub.sectionTime || 0,
            distance: sub.distance,
            startName: sub.startName || '출발',
            endName: sub.endName || '도착',
            start,
            end,
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
            start,
            end,
            passCoords: passCoords.length > 0 ? passCoords : undefined,
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
            start,
            end,
            passCoords: passCoords.length > 0 ? passCoords : undefined,
          };
        }
        return null;
      })
      .filter((leg): leg is RouteLeg => leg !== null);

    // 환승 횟수 계산 (대중교통 구간 수 - 1, 최소 0)
    const transitCount = legs.filter((leg) => leg.mode !== 'walk').length;
    const transferCount = Math.max(0, transitCount - 1);

    // 도보 시간 합계
    const walkTime = legs.filter((leg) => leg.mode === 'walk').reduce((sum, leg) => sum + leg.duration, 0);

    return {
      id: String(index + 1),
      origin: { name: originName, x: originCoords.lng, y: originCoords.lat },
      destination: { name: destName, x: destCoords.lng, y: destCoords.lat },
      totalTime: info.totalTime,
      totalDistance: info.totalDistance,
      walkTime,
      transferCount,
      fare: info.payment,
      legs,
      pathType: info.pathType,
    };
  });
}

/**
 * Mock 경로 데이터 생성 (API 키 없을 때 사용)
 */
export function getMockRoutes(origin: string, dest: string): Route[] {
  return [
    {
      id: '1',
      origin: { name: origin },
      destination: { name: dest },
      totalTime: 35,
      walkTime: 5,
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
