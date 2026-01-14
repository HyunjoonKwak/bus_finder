/**
 * 공공데이터포털 버스 정류소 정보 API
 * - 서울시: ws.bus.go.kr
 * - 경기도: apis.data.go.kr/6410000
 */

export interface StationInfo {
  stationId: string;
  stationName: string;
  arsId?: string; // 정류소 고유번호
  x: string; // 경도
  y: string; // 위도
  distance?: number; // 거리 (미터)
}

interface GyeonggiStationResponse {
  stationId: string | number;
  stationName: string;
  mobileNo?: string;
  x?: string | number;
  y?: string | number;
}

function getApiKey(): string {
  const apiKey = process.env.TRAFFIC_API_KEY;
  if (!apiKey) {
    throw new Error('TRAFFIC_API_KEY 환경 변수가 설정되지 않았습니다.');
  }
  return apiKey;
}

/**
 * 두 지점 간 거리 계산 (Haversine formula)
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // 지구 반지름 (미터)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 경기도 정류소 검색 (키워드 기반)
 */
export async function searchGyeonggiStation(keyword: string): Promise<StationInfo[]> {
  const apiKey = getApiKey();
  const url = `https://apis.data.go.kr/6410000/busstationservice/v2/getBusStationListv2?serviceKey=${encodeURIComponent(apiKey)}&keyword=${encodeURIComponent(keyword)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const stationList = data?.response?.msgBody?.busStationList;
    if (!stationList) return [];

    const stations = Array.isArray(stationList) ? stationList : [stationList];

    return stations.map((station: GyeonggiStationResponse) => ({
      stationId: String(station.stationId),
      stationName: station.stationName,
      arsId: station.mobileNo || undefined,
      x: station.x ? String(station.x) : '',
      y: station.y ? String(station.y) : '',
    }));
  } catch (error) {
    console.error('Gyeonggi station search error:', error);
    return [];
  }
}

/**
 * 경기도 좌표 기반 주변 정류소 검색
 */
export async function searchGyeonggiNearbyStations(
  x: number,
  y: number,
  radius: number = 500
): Promise<StationInfo[]> {
  const apiKey = getApiKey();
  // 경기도 API는 좌표 기반 검색을 직접 지원하지 않으므로
  // 좌표를 기반으로 근처 지역명으로 검색 후 거리 필터링
  // 또는 전체 정류소 중 좌표로 필터링

  // 좌표 기반 검색 API 사용
  const url = `https://apis.data.go.kr/6410000/busstationservice/v2/getBusStationAroundListv2?serviceKey=${encodeURIComponent(apiKey)}&x=${x}&y=${y}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const stationList = data?.response?.msgBody?.busStationAroundList;
    if (!stationList) return [];

    const stations = Array.isArray(stationList) ? stationList : [stationList];

    return stations
      .map((station: GyeonggiStationResponse) => {
        const stationX = station.x ? parseFloat(String(station.x)) : 0;
        const stationY = station.y ? parseFloat(String(station.y)) : 0;
        const distance = calculateDistance(y, x, stationY, stationX);

        return {
          stationId: String(station.stationId),
          stationName: station.stationName,
          arsId: station.mobileNo || undefined,
          x: station.x ? String(station.x) : '',
          y: station.y ? String(station.y) : '',
          distance,
        };
      })
      .filter((s: StationInfo) => (s.distance || 0) <= radius)
      .sort((a: StationInfo, b: StationInfo) => (a.distance || 0) - (b.distance || 0));
  } catch (error) {
    console.error('Gyeonggi nearby stations error:', error);
    return [];
  }
}

/**
 * 서울시 정류소 검색 (키워드 기반)
 */
export async function searchSeoulStation(keyword: string): Promise<StationInfo[]> {
  const apiKey = getApiKey();
  const url = `http://ws.bus.go.kr/api/rest/stationinfo/getStationByName?serviceKey=${encodeURIComponent(apiKey)}&stSrch=${encodeURIComponent(keyword)}`;

  try {
    const response = await fetch(url);
    const text = await response.text();

    const stations: StationInfo[] = [];
    const itemRegex = /<itemList>([\s\S]*?)<\/itemList>/g;
    let match;

    while ((match = itemRegex.exec(text)) !== null) {
      const item = match[1];
      const getValue = (tag: string): string => {
        const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
        const m = item.match(regex);
        return m ? m[1] : '';
      };

      const stationId = getValue('stId');
      const stationName = getValue('stNm');
      const arsId = getValue('arsId');
      const tmX = getValue('tmX');
      const tmY = getValue('tmY');

      if (stationId && stationName) {
        stations.push({
          stationId,
          stationName,
          arsId: arsId && arsId !== '0' ? arsId : undefined,
          x: tmX || '',
          y: tmY || '',
        });
      }
    }

    return stations;
  } catch (error) {
    console.error('Seoul station search error:', error);
    return [];
  }
}

/**
 * 서울시 좌표 기반 주변 정류소 검색
 */
export async function searchSeoulNearbyStations(
  x: number,
  y: number,
  radius: number = 500
): Promise<StationInfo[]> {
  const apiKey = getApiKey();
  const url = `http://ws.bus.go.kr/api/rest/stationinfo/getStationByPos?serviceKey=${encodeURIComponent(apiKey)}&tmX=${x}&tmY=${y}&radius=${radius}`;

  try {
    const response = await fetch(url);
    const text = await response.text();

    const stations: StationInfo[] = [];
    const itemRegex = /<itemList>([\s\S]*?)<\/itemList>/g;
    let match;

    while ((match = itemRegex.exec(text)) !== null) {
      const item = match[1];
      const getValue = (tag: string): string => {
        const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
        const m = item.match(regex);
        return m ? m[1] : '';
      };

      const stationId = getValue('stId') || getValue('stationId');
      const stationName = getValue('stNm') || getValue('stationNm');
      const arsId = getValue('arsId');
      const tmX = getValue('gpsX') || getValue('tmX');
      const tmY = getValue('gpsY') || getValue('tmY');
      const dist = getValue('dist') || getValue('distance');

      if (stationId && stationName) {
        stations.push({
          stationId,
          stationName,
          arsId: arsId && arsId !== '0' ? arsId : undefined,
          x: tmX || '',
          y: tmY || '',
          distance: dist ? parseFloat(dist) : undefined,
        });
      }
    }

    // 거리순 정렬
    return stations.sort((a, b) => (a.distance || 0) - (b.distance || 0));
  } catch (error) {
    console.error('Seoul nearby stations error:', error);
    return [];
  }
}

/**
 * 통합 정류소 검색 (경기도 + 서울 동시 검색)
 */
export async function searchStation(keyword: string): Promise<StationInfo[]> {
  // 경기도와 서울 동시 검색
  const [gyeonggiStations, seoulStations] = await Promise.all([
    searchGyeonggiStation(keyword),
    searchSeoulStation(keyword),
  ]);

  // 중복 제거 (정류소명 + 좌표 기준)
  const seenKeys = new Set<string>();
  const allStations: StationInfo[] = [];

  for (const station of [...gyeonggiStations, ...seoulStations]) {
    const key = `${station.stationName}_${station.x}_${station.y}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      allStations.push(station);
    }
  }

  return allStations;
}

/**
 * 통합 주변 정류소 검색 (경기도 + 서울 동시 검색)
 */
export async function searchNearbyStations(
  x: number,
  y: number,
  radius: number = 500
): Promise<StationInfo[]> {
  // 경기도와 서울 동시 검색
  const [gyeonggiStations, seoulStations] = await Promise.all([
    searchGyeonggiNearbyStations(x, y, radius),
    searchSeoulNearbyStations(x, y, radius),
  ]);

  // 중복 제거 (정류소명 + 좌표 기준)
  const seenKeys = new Set<string>();
  const allStations: StationInfo[] = [];

  for (const station of [...gyeonggiStations, ...seoulStations]) {
    const key = `${station.stationName}_${station.x}_${station.y}`;
    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      allStations.push(station);
    }
  }

  // 거리순 정렬
  return allStations.sort((a, b) => (a.distance || 0) - (b.distance || 0));
}
