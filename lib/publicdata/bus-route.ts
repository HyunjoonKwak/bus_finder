/**
 * 공공데이터포털 버스 노선 정보 API
 * - 서울시: ws.bus.go.kr
 * - 경기도: apis.data.go.kr/6410000
 */

export interface BusRouteInfo {
  routeId: string;
  routeName: string;
  routeType?: string; // 노선 유형 (간선, 지선 등)
  startStation?: string; // 기점
  endStation?: string; // 종점
  firstTime?: string; // 첫차 시간
  lastTime?: string; // 막차 시간
  interval?: number; // 배차간격 (분)
  companyName?: string; // 운수회사
}

export interface BusRouteStation {
  stationId: string;
  stationName: string;
  stationNo?: string; // 정류소 번호 (arsId)
  sequence: number; // 정류소 순서
  x?: string;
  y?: string;
  direction?: string; // 방향
}

export interface BusPosition {
  plateNo: string; // 차량 번호
  stationSeq: number; // 현재 정류소 순번
  stopFlag: boolean; // 정류소 도착 여부
  lowPlate: boolean; // 저상버스 여부
  crowded?: number; // 혼잡도
  direction?: number; // 방향 (0: 상행/기점→종점, 1: 하행/종점→기점)
}

function getApiKey(): string {
  const apiKey = process.env.TRAFFIC_API_KEY;
  if (!apiKey) {
    throw new Error('TRAFFIC_API_KEY 환경 변수가 설정되지 않았습니다.');
  }
  return apiKey;
}

/**
 * 서울시 버스 노선 상세 정보 조회 (routeId로 직접 조회)
 */
export async function getSeoulBusRouteInfo(routeId: string): Promise<BusRouteInfo | null> {
  const apiKey = getApiKey();
  const url = `http://ws.bus.go.kr/api/rest/busRouteInfo/getRouteInfo?serviceKey=${encodeURIComponent(apiKey)}&busRouteId=${routeId}`;

  try {
    const response = await fetch(url);
    const text = await response.text();

    const itemRegex = /<itemList>([\s\S]*?)<\/itemList>/;
    const match = itemRegex.exec(text);

    if (!match) return null;

    const item = match[1];
    const getValue = (tag: string): string => {
      const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
      const m = item.match(regex);
      return m ? m[1] : '';
    };

    return {
      routeId: getValue('busRouteId') || routeId,
      routeName: getValue('busRouteNm'),
      routeType: getValue('routeType'),
      startStation: getValue('stStationNm'),
      endStation: getValue('edStationNm'),
      firstTime: getValue('firstBusTm'),
      lastTime: getValue('lastBusTm'),
      interval: parseInt(getValue('term')) || undefined,
      companyName: getValue('corpNm'),
    };
  } catch (error) {
    console.error('Seoul bus route info error:', error);
    return null;
  }
}

/**
 * 서울시 버스 노선 검색
 */
export async function searchSeoulBusRoute(busNo: string): Promise<BusRouteInfo[]> {
  const apiKey = getApiKey();
  const url = `http://ws.bus.go.kr/api/rest/busRouteInfo/getBusRouteList?serviceKey=${encodeURIComponent(apiKey)}&strSrch=${encodeURIComponent(busNo)}`;

  try {
    const response = await fetch(url);
    const text = await response.text();

    const routes: BusRouteInfo[] = [];
    const itemRegex = /<itemList>([\s\S]*?)<\/itemList>/g;
    let match;

    while ((match = itemRegex.exec(text)) !== null) {
      const item = match[1];
      const getValue = (tag: string): string => {
        const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
        const m = item.match(regex);
        return m ? m[1] : '';
      };

      routes.push({
        routeId: getValue('busRouteId'),
        routeName: getValue('busRouteNm'),
        routeType: getValue('routeType'),
        startStation: getValue('stStationNm'),
        endStation: getValue('edStationNm'),
        firstTime: getValue('firstBusTm'),
        lastTime: getValue('lastBusTm'),
        interval: parseInt(getValue('term')) || undefined,
        companyName: getValue('corpNm'),
      });
    }

    return routes;
  } catch (error) {
    console.error('Seoul bus route search error:', error);
    return [];
  }
}

/**
 * 서울시 버스 노선 경유 정류소 조회
 */
export async function getSeoulBusRouteStations(routeId: string): Promise<BusRouteStation[]> {
  const apiKey = getApiKey();
  const url = `http://ws.bus.go.kr/api/rest/busRouteInfo/getStaionByRoute?serviceKey=${encodeURIComponent(apiKey)}&busRouteId=${routeId}`;

  try {
    const response = await fetch(url);
    const text = await response.text();

    const stations: BusRouteStation[] = [];
    const itemRegex = /<itemList>([\s\S]*?)<\/itemList>/g;
    let match;

    while ((match = itemRegex.exec(text)) !== null) {
      const item = match[1];
      const getValue = (tag: string): string => {
        const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
        const m = item.match(regex);
        return m ? m[1] : '';
      };

      stations.push({
        stationId: getValue('station'),
        stationName: getValue('stationNm'),
        stationNo: getValue('arsId') || undefined,
        sequence: parseInt(getValue('seq')) || 0,
        x: getValue('gpsX') || undefined,
        y: getValue('gpsY') || undefined,
        direction: getValue('direction') || undefined,
      });
    }

    return stations.sort((a, b) => a.sequence - b.sequence);
  } catch (error) {
    console.error('Seoul bus route stations error:', error);
    return [];
  }
}

/**
 * 서울시 버스 위치 정보 조회
 */
export async function getSeoulBusPositions(routeId: string): Promise<BusPosition[]> {
  const apiKey = getApiKey();
  const url = `http://ws.bus.go.kr/api/rest/buspos/getBusPosByRtid?serviceKey=${encodeURIComponent(apiKey)}&busRouteId=${routeId}`;

  try {
    const response = await fetch(url);
    const text = await response.text();

    const positions: BusPosition[] = [];
    const itemRegex = /<itemList>([\s\S]*?)<\/itemList>/g;
    let match;

    while ((match = itemRegex.exec(text)) !== null) {
      const item = match[1];
      const getValue = (tag: string): string => {
        const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
        const m = item.match(regex);
        return m ? m[1] : '';
      };

      positions.push({
        plateNo: getValue('plainNo') || getValue('vehId'),
        stationSeq: parseInt(getValue('sectOrd')) || 0,
        stopFlag: getValue('stopFlag') === '1',
        lowPlate: getValue('busType') === '1',
        crowded: getValue('congetion') ? parseInt(getValue('congetion')) : undefined,
        direction: getValue('busDirection') ? parseInt(getValue('busDirection')) : undefined, // 서울시: 0=상행, 1=하행
      });
    }

    return positions;
  } catch (error) {
    console.error('Seoul bus positions error:', error);
    return [];
  }
}

/**
 * 경기도 버스 노선 상세 정보 조회 (routeId로 직접 조회)
 */
export async function getGyeonggiBusRouteInfo(routeId: string): Promise<BusRouteInfo | null> {
  const apiKey = getApiKey();
  const url = `https://apis.data.go.kr/6410000/busrouteservice/v2/getBusRouteInfoItemv2?serviceKey=${encodeURIComponent(apiKey)}&routeId=${routeId}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const routeInfo = data?.response?.msgBody?.busRouteInfoItem;
    if (!routeInfo) return null;

    return {
      routeId: String(routeInfo.routeId) || routeId,
      routeName: routeInfo.routeName,
      routeType: routeInfo.routeTypeName,
      startStation: routeInfo.startStationName,
      endStation: routeInfo.endStationName,
      firstTime: routeInfo.upFirstTime || routeInfo.downFirstTime,
      lastTime: routeInfo.upLastTime || routeInfo.downLastTime,
      interval: routeInfo.peekAlloc ? parseInt(routeInfo.peekAlloc) : undefined,
      companyName: routeInfo.companyName,
    };
  } catch (error) {
    console.error('Gyeonggi bus route info error:', error);
    return null;
  }
}

/**
 * 경기도 버스 노선 검색
 */
export async function searchGyeonggiBusRoute(busNo: string): Promise<BusRouteInfo[]> {
  const apiKey = getApiKey();
  const url = `https://apis.data.go.kr/6410000/busrouteservice/v2/getBusRouteListv2?serviceKey=${encodeURIComponent(apiKey)}&keyword=${encodeURIComponent(busNo)}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const routeList = data?.response?.msgBody?.busRouteList;
    if (!routeList) return [];

    const routes = Array.isArray(routeList) ? routeList : [routeList];

    return routes.map((route: any) => ({
      routeId: String(route.routeId),
      routeName: route.routeName,
      routeType: route.routeTypeName,
      startStation: route.startStationName,
      endStation: route.endStationName,
      companyName: route.companyName,
    }));
  } catch (error) {
    console.error('Gyeonggi bus route search error:', error);
    return [];
  }
}

/**
 * 경기도 버스 노선 경유 정류소 조회
 */
export async function getGyeonggiBusRouteStations(routeId: string): Promise<BusRouteStation[]> {
  const apiKey = getApiKey();
  const url = `https://apis.data.go.kr/6410000/busrouteservice/v2/getBusRouteStationListv2?serviceKey=${encodeURIComponent(apiKey)}&routeId=${routeId}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const stationList = data?.response?.msgBody?.busRouteStationList;
    if (!stationList) return [];

    const stations = Array.isArray(stationList) ? stationList : [stationList];

    return stations.map((station: any, index: number) => ({
      stationId: String(station.stationId),
      stationName: station.stationName,
      stationNo: station.mobileNo || undefined,
      sequence: station.stationSeq || index + 1,
      x: station.x ? String(station.x) : undefined,
      y: station.y ? String(station.y) : undefined,
    })).sort((a: BusRouteStation, b: BusRouteStation) => a.sequence - b.sequence);
  } catch (error) {
    console.error('Gyeonggi bus route stations error:', error);
    return [];
  }
}

/**
 * 경기도 버스 위치 정보 조회
 */
export async function getGyeonggiBusPositions(routeId: string): Promise<BusPosition[]> {
  const apiKey = getApiKey();
  const url = `https://apis.data.go.kr/6410000/buslocationservice/v2/getBusLocationListv2?serviceKey=${encodeURIComponent(apiKey)}&routeId=${routeId}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const busList = data?.response?.msgBody?.busLocationList;
    if (!busList) return [];

    const buses = Array.isArray(busList) ? busList : [busList];

    return buses.map((bus: any) => ({
      plateNo: bus.plateNo,
      stationSeq: parseInt(bus.stationSeq) || 0,
      stopFlag: bus.stopFlag === '1',
      lowPlate: bus.lowPlate === '1',
      crowded: bus.crowded ? parseInt(bus.crowded) : undefined,
      direction: bus.upDownFlag !== undefined ? parseInt(bus.upDownFlag) : undefined, // 경기도: 0=상행, 1=하행
    }));
  } catch (error) {
    console.error('Gyeonggi bus positions error:', error);
    return [];
  }
}

/**
 * 버스 노선 상세 정보 조회 (서울/경기 자동 판단)
 * routeId: 노선 ID (없으면 버스 번호로 검색)
 * busNo: 버스 번호 (routeId가 없을 때 사용)
 */
export async function getBusRouteDetail(
  routeId: string,
  busNo?: string
): Promise<{
  routeInfo: BusRouteInfo | null;
  stations: BusRouteStation[];
  busPositions: BusPosition[];
}> {
  // 서울시 routeId는 8자리 숫자 (1로 시작)
  const isSeoulRouteId = /^1\d{7}$/.test(routeId);
  // 경기도 routeId는 9자리 숫자 (2로 시작하는 경우가 많음)
  const isGyeonggiRouteId = /^2\d{8}$/.test(routeId);

  let routeInfo: BusRouteInfo | null = null;
  let stations: BusRouteStation[] = [];
  let busPositions: BusPosition[] = [];

  try {
    if (isSeoulRouteId) {
      // 서울시 API - routeId로 직접 상세 정보 조회
      const [routeInfoResult, stationResult, positionResult] = await Promise.all([
        getSeoulBusRouteInfo(routeId),
        getSeoulBusRouteStations(routeId),
        getSeoulBusPositions(routeId),
      ]);

      routeInfo = routeInfoResult || (busNo ? { routeId, routeName: busNo } : null);
      stations = stationResult;
      busPositions = positionResult;
    } else if (isGyeonggiRouteId) {
      // 경기도 API - routeId로 직접 상세 정보 조회
      const [routeInfoResult, stationResult, positionResult] = await Promise.all([
        getGyeonggiBusRouteInfo(routeId),
        getGyeonggiBusRouteStations(routeId),
        getGyeonggiBusPositions(routeId),
      ]);

      routeInfo = routeInfoResult || (busNo ? { routeId, routeName: busNo } : null);
      stations = stationResult;
      busPositions = positionResult;
    } else if (busNo) {
      // routeId 형식이 맞지 않으면 버스 번호로 검색 시도
      // 서울시 먼저 시도
      const seoulRoutes = await searchSeoulBusRoute(busNo);
      if (seoulRoutes.length > 0) {
        const route = seoulRoutes[0];
        const [routeInfoResult, stationResult, positionResult] = await Promise.all([
          getSeoulBusRouteInfo(route.routeId),
          getSeoulBusRouteStations(route.routeId),
          getSeoulBusPositions(route.routeId),
        ]);
        routeInfo = routeInfoResult || route;
        stations = stationResult;
        busPositions = positionResult;
      } else {
        // 경기도 시도
        const gyeonggiRoutes = await searchGyeonggiBusRoute(busNo);
        if (gyeonggiRoutes.length > 0) {
          const route = gyeonggiRoutes[0];
          const [routeInfoResult, stationResult, positionResult] = await Promise.all([
            getGyeonggiBusRouteInfo(route.routeId),
            getGyeonggiBusRouteStations(route.routeId),
            getGyeonggiBusPositions(route.routeId),
          ]);
          routeInfo = routeInfoResult || route;
          stations = stationResult;
          busPositions = positionResult;
        }
      }
    }
  } catch (error) {
    console.error('getBusRouteDetail error:', error);
  }

  return { routeInfo, stations, busPositions };
}
