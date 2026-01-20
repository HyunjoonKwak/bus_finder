/**
 * ODSay 경로 검색 관련 타입 정의
 */

// 수도권 (서울+경기+인천) 좌표 범위
export const SEOUL_METRO_BOUNDS = {
  minX: 126.5,
  maxX: 127.8,
  minY: 36.9,
  maxY: 38.0,
};

// 카카오 장소 검색 결과 타입
export interface KakaoPlaceDocument {
  place_name: string;
  address_name: string;
  x: string;
  y: string;
}

export interface KakaoSearchResponse {
  documents: KakaoPlaceDocument[];
}

// ODSay API 타입
export interface ODSayLane {
  busNo?: string;
  busID?: string;
  name?: string;
  subwayCode?: string;
}

export interface ODSayPassStop {
  stationName?: string;
  x?: string;
  y?: string;
}

export interface ODSaySubPath {
  trafficType: number; // 1: 지하철, 2: 버스, 3: 도보
  sectionTime?: number;
  distance?: number;
  startName?: string;
  endName?: string;
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
  stationCount?: number;
  lane?: ODSayLane[];
  passStopList?: {
    stations?: ODSayPassStop[];
  };
}

export interface ODSayPathInfo {
  totalTime: number;
  totalDistance: number;
  payment: number;
  pathType: number;
}

export interface ODSayPath {
  info: ODSayPathInfo;
  subPath: ODSaySubPath[];
}

export interface ODSayResult {
  result?: {
    path?: ODSayPath[];
  };
  error?: {
    code?: number;
    message?: string;
  };
}

// 좌표 타입
export interface Coordinate {
  x: number;
  y: number;
}

// 경로 Leg 타입
export interface RouteLeg {
  mode: 'walk' | 'bus' | 'subway';
  duration: number;
  distance?: number;
  routeName?: string;
  routeId?: string | number;
  startName: string;
  endName: string;
  stationCount?: number;
  start?: Coordinate;
  end?: Coordinate;
  passCoords?: Coordinate[];
}

// 경로 타입
export interface Route {
  id: string;
  origin: { name: string; x?: number; y?: number };
  destination: { name: string; x?: number; y?: number };
  totalTime: number;
  totalDistance?: number;
  walkTime: number;
  transferCount: number;
  fare: number;
  legs: RouteLeg[];
  pathType: number;
}

// 좌표 검색 결과
export interface CoordinateResult {
  lat: number;
  lng: number;
  placeName: string;
}
