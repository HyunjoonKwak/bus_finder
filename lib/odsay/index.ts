/**
 * ODSay API 래퍼 함수들
 * 수도권 대중교통 정보 조회
 */

import {
  StationSearchResponse,
  StationInfo,
  BusSearchResponse,
  BusLaneInfo,
  NearbyStationResponse,
  NearbyStationInfo,
  RealtimeArrivalResponse,
  RealtimeArrivalInfo,
  BusLaneDetailResponse,
  BusLaneDetailInfo,
  BusStationInfo,
  BusRealTimeInfo,
  CITY_CODE,
} from './types';

const ODSAY_API_BASE = 'https://api.odsay.com/v1/api';

function getApiKey(): string {
  const apiKey = process.env.ODSAY_API_KEY;
  if (!apiKey) {
    throw new Error('ODSAY_API_KEY 환경 변수가 설정되지 않았습니다.');
  }
  return apiKey;
}

/**
 * 정류소 검색
 * @param stationName 정류소명
 * @param cityCode 도시 코드 (기본값: 수도권)
 */
export async function searchStation(
  stationName: string,
  cityCode: number = CITY_CODE.METROPOLITAN
): Promise<StationInfo[]> {
  const apiKey = getApiKey();
  const url = `${ODSAY_API_BASE}/searchStation?lang=0&stationName=${encodeURIComponent(stationName)}&CID=${cityCode}&apiKey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url);
  const data: StationSearchResponse = await response.json();

  if (data.error) {
    console.error('ODSay searchStation error:', data.error);
    return [];
  }

  return data.result?.station || [];
}

/**
 * 버스 노선 검색
 * @param busNo 버스 번호
 * @param cityCode 도시 코드 (기본값: 수도권)
 */
export async function searchBusLane(
  busNo: string,
  cityCode: number = CITY_CODE.METROPOLITAN
): Promise<BusLaneInfo[]> {
  const apiKey = getApiKey();
  const url = `${ODSAY_API_BASE}/searchBusLane?lang=0&busNo=${encodeURIComponent(busNo)}&CID=${cityCode}&apiKey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url);
  const data: BusSearchResponse = await response.json();

  if (data.error) {
    console.error('ODSay searchBusLane error:', data.error);
    return [];
  }

  return data.result?.lane || [];
}

/**
 * 주변 정류소 검색
 * @param x 경도
 * @param y 위도
 * @param radius 반경 (미터, 기본값: 500)
 */
export async function searchNearbyStations(
  x: number,
  y: number,
  radius: number = 500
): Promise<NearbyStationInfo[]> {
  const apiKey = getApiKey();
  const url = `${ODSAY_API_BASE}/pointSearch?lang=0&x=${x}&y=${y}&radius=${radius}&apiKey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url);
  const data: NearbyStationResponse = await response.json();

  if (data.error) {
    console.error('ODSay pointSearch error:', data.error);
    return [];
  }

  return data.result?.station || [];
}

/**
 * 정류소 실시간 도착 정보
 * @param stationId 정류소 ID
 */
export async function getRealtimeArrival(
  stationId: string
): Promise<RealtimeArrivalInfo[]> {
  const apiKey = getApiKey();
  const url = `${ODSAY_API_BASE}/realtimeStation?lang=0&stationID=${stationId}&apiKey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url);
  const data: RealtimeArrivalResponse = await response.json();

  if (data.error) {
    console.error('ODSay realtimeStation error:', data.error);
    return [];
  }

  return data.result?.real || [];
}

/**
 * 버스 노선 상세 정보 (경유 정류소 + 실시간 버스 위치)
 * @param busId 버스 ID
 */
export async function getBusLaneDetail(busId: string): Promise<{
  lane: BusLaneDetailInfo[];
  stations: BusStationInfo[];
  realtime: BusRealTimeInfo[];
}> {
  const apiKey = getApiKey();
  const url = `${ODSAY_API_BASE}/busLaneDetail?lang=0&busID=${busId}&apiKey=${encodeURIComponent(apiKey)}`;

  const response = await fetch(url);
  const data: BusLaneDetailResponse = await response.json();

  if (data.error) {
    console.error('ODSay busLaneDetail error:', data.error);
    return { lane: [], stations: [], realtime: [] };
  }

  return {
    lane: data.result?.lane || [],
    stations: data.result?.station || [],
    realtime: data.result?.busRealTimeInfo || [],
  };
}

/**
 * 도착 시간을 분:초 문자열로 변환
 * @param seconds 초
 */
export function formatArrivalTime(seconds: number): string {
  if (seconds < 60) {
    return '곧 도착';
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}시간 ${remainingMinutes}분`;
  }
  return `${minutes}분`;
}

/**
 * 거리를 미터/km 문자열로 변환
 * @param meters 미터
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}
