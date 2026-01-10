// ODSay API 응답 타입 정의

// 정류소 검색 응답
export interface StationSearchResponse {
  result?: {
    station?: StationInfo[];
  };
  error?: {
    code: number;
    message: string;
  };
}

export interface StationInfo {
  stationID: string;
  stationName: string;
  x: string; // 경도
  y: string; // 위도
  CID: number; // 도시 코드 (1: 수도권)
  arsID?: string; // 정류소 고유번호
  do?: string; // 도/시
  gu?: string; // 구
  dong?: string; // 동
}

// 버스 노선 검색 응답
export interface BusSearchResponse {
  result?: {
    lane?: BusLaneInfo[];
  };
  error?: {
    code: number;
    message: string;
  };
}

export interface BusLaneInfo {
  busID: string;
  busNo: string;
  busLocalBlID?: string;
  type: number; // 1: 일반, 2: 좌석, 3: 마을, 4: 직행좌석, 5: 공항, 6: 간선급행
  busCityCode: number;
  busStartPoint?: string;
  busEndPoint?: string;
  busFirstTime?: string;
  busLastTime?: string;
  busInterval?: string;
}

// 주변 정류소 검색 응답
export interface NearbyStationResponse {
  result?: {
    station?: NearbyStationInfo[];
  };
  error?: {
    code: number;
    message: string;
  };
}

export interface NearbyStationInfo {
  stationID: string;
  stationName: string;
  x: string;
  y: string;
  arsID?: string;
  distance: number; // 거리 (미터)
}

// 실시간 도착 정보 응답
export interface RealtimeArrivalResponse {
  result?: {
    real?: RealtimeArrivalInfo[];
  };
  error?: {
    code: number;
    message: string;
  };
}

export interface RealtimeArrivalInfo {
  routeID: string;
  routeNm: string;
  routeType?: number; // 버스 타입 (서울: 1~6, 경기: 11~30)
  arrival1?: {
    arrivalSec: number; // 도착 예정 시간 (초)
    leftStation: number; // 남은 정류장 수
    busPlateNo?: string; // 버스 번호판 (차량번호)
    busPosition?: string; // 버스 현재 위치 정류장명
    remainSeat?: number; // 잔여 좌석 (-1: 정보없음)
    lowPlate?: boolean; // 저상버스 여부
    crowded?: number; // 혼잡도 (1:여유, 2:보통, 3:혼잡, 4:매우혼잡)
  };
  arrival2?: {
    arrivalSec: number;
    leftStation: number;
    busPlateNo?: string;
    busPosition?: string;
    remainSeat?: number;
    lowPlate?: boolean;
    crowded?: number;
  };
}

// 버스 노선 상세 정보 응답
export interface BusLaneDetailResponse {
  result?: {
    lane?: BusLaneDetailInfo[];
    station?: BusStationInfo[];
    busRealTimeInfo?: BusRealTimeInfo[];
  };
  error?: {
    code: number;
    message: string;
  };
}

export interface BusLaneDetailInfo {
  busID: string;
  busNo: string;
  type: number;
  busStartPoint: string;
  busEndPoint: string;
  busFirstTime: string;
  busLastTime: string;
  busInterval: string;
}

export interface BusStationInfo {
  idx: number;
  stationID: string;
  stationName: string;
  x: string;
  y: string;
  arsID?: string;
  isExist?: number; // 정류소 존재 여부
}

export interface BusRealTimeInfo {
  busPlateNo: string;
  busStationSeq: number; // 현재 정류장 순번
  busDirection: number; // 방향 (1: 정방향, 2: 역방향)
  busSpeed?: number;
  busState?: number;
}

// 공통 API 응답 래퍼
export interface ODSayApiResponse<T> {
  result?: T;
  error?: {
    code: number;
    message: string;
  };
}

// 버스 타입 매핑
export const BUS_TYPE_MAP: Record<number, string> = {
  1: '일반',
  2: '좌석',
  3: '마을',
  4: '직행좌석',
  5: '공항',
  6: '간선급행',
  11: '일반(저상)',
  12: '좌석(저상)',
  13: '마을(저상)',
};

// 도시 코드
export const CITY_CODE = {
  METROPOLITAN: 1, // 수도권
};
