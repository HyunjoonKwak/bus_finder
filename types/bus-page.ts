/**
 * 버스 페이지 관련 타입 정의
 */

// Kakao Maps 타입 정의 (SDK가 TypeScript를 완전 지원하지 않아 any 사용)
/* eslint-disable @typescript-eslint/no-explicit-any */
export type KakaoMap = any;
export type KakaoLatLng = any;
export type KakaoLatLngBounds = any;
export type KakaoOverlay = any;
export type KakaoCircle = any;
export type KakaoPolyline = any;
export type KakaoCustomOverlay = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface BusPosition {
  stationSeq: number;
  busStationSeq: number;
  plateNo: string;
  lowPlate?: boolean;
  crowded?: number;
  direction?: number;
}

export type TabType = 'station' | 'route' | 'search' | 'tracking' | 'favorites';

export interface FavoriteStation {
  id: string;
  station_id: string;
  station_name: string;
  x?: string;
  y?: string;
}

export interface FavoriteRoute {
  id: string;
  bus_id: string;
  bus_no: string;
  bus_type?: number;
}

export interface TrackingTarget {
  id: string;
  bus_id: string;
  bus_no: string;
  station_id: string;
  station_name: string;
  ars_id?: string;
  is_active: boolean;
}

export interface TrackingTargetWithArrival extends TrackingTarget {
  arrival?: {
    arrivalSec: number;
    leftStation: number;
  };
  lastChecked?: Date;
}

export interface SearchHistoryItem {
  type: 'station' | 'bus';
  id: string;
  name: string;
  subInfo?: string;
  x?: string;
  y?: string;
  arsID?: string;
  busType?: number;
  timestamp: number;
}

// API 응답 타입
export interface ArrivalApiItem {
  routeId?: string;
  routeNm?: string;
  predictTime1?: number;
  predictTime2?: number;
  locationNo1?: number;
  locationNo2?: number;
  vehicleNo1?: string;
  vehicleNo2?: string;
  lowPlate1?: boolean;
  lowPlate2?: boolean;
  crowded1?: number;
  crowded2?: number;
  busType?: number;
  routeType?: string;
}
