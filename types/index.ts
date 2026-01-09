// 버스 노선 타입
export interface BusRoute {
  routeId: string;
  routeName: string;
  routeType: 'bus' | 'subway' | 'walk';
}

// 경로 정보 타입
export interface RouteInfo {
  id: string;
  origin: Location;
  destination: Location;
  totalTime: number; // 분
  totalDistance: number; // 미터
  walkTime: number; // 도보 시간 (분)
  transferCount: number; // 환승 횟수
  fare: number; // 요금
  legs: RouteLeg[];
}

// 경로 구간 타입
export interface RouteLeg {
  mode: 'walk' | 'bus' | 'subway';
  distance: number;
  duration: number;
  startName: string;
  endName: string;
  routeName?: string;
  routeId?: string;
}

// 위치 타입
export interface Location {
  name: string;
  lat: number;
  lng: number;
}

// 검색 조건 타입
export interface SearchFilters {
  minimizeWalk: boolean; // 최소 도보
  minimizeTransfer: boolean; // 최소 환승
  hasLuggage: boolean; // 짐 있음
  isRainy: boolean; // 비 오는 날
}

// 사용자 타입
export interface User {
  id: string;
  email: string;
  nickname?: string;
  createdAt: string;
}
