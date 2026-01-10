/**
 * 공공데이터포털 버스 도착 정보 API
 * - 서울시: ws.bus.go.kr
 * - 경기도: apis.data.go.kr/6410000
 */

export interface BusArrivalInfo {
  routeName: string; // 버스 번호
  routeId?: string;
  routeType?: number; // 버스 타입 (서울: 1일반,2좌석,3마을,4직행,5공항,6간선급행 / 경기: 11일반,12좌석,13마을,14직행좌석,15공항,16간선급행,21광역,22시외)
  predictTime1: number; // 첫번째 버스 도착 예정 시간(분)
  predictTimeSec1?: number; // 첫번째 버스 도착 예정 시간(초)
  locationNo1?: number; // 첫번째 버스 남은 정류장 수
  remainSeat1?: number; // 첫번째 버스 잔여 좌석
  plateNo1?: string; // 첫번째 버스 차량번호
  lowPlate1?: boolean; // 첫번째 버스 저상버스 여부
  crowded1?: number; // 첫번째 버스 혼잡도 (1:여유~4:매우혼잡)
  predictTime2?: number; // 두번째 버스 도착 예정 시간(분)
  predictTimeSec2?: number;
  locationNo2?: number; // 두번째 버스 남은 정류장 수
  remainSeat2?: number;
  plateNo2?: string;
  lowPlate2?: boolean;
  crowded2?: number;
  stationName?: string;
  direction?: string; // 방향
}

// 버스 타입 코드 -> 표시명 매핑 (경기도 도착정보 API 기준)
// API 문서: 11:직행좌석형, 12:좌석형, 13:일반형, 14:광역급행형, 15:따복형, 16:경기순환
// 21:직행좌석형농어촌, 22:좌석형농어촌, 23:일반형농어촌, 30:마을, 41~43:시외, 51~53:공항
export const BUS_TYPE_NAMES: Record<number, string> = {
  // 경기도 시내버스
  11: '직행좌석',
  12: '좌석',
  13: '일반',
  14: '광역급행',
  15: '따복',
  16: '경기순환',
  17: '직행좌석',
  // 경기도 농어촌버스
  21: '직행좌석',
  22: '좌석',
  23: '일반',
  // 마을버스
  30: '마을',
  // 시외버스
  41: '고속',
  42: '좌석',
  43: '일반',
  // 공항버스
  51: '리무진',
  52: '좌석',
  53: '일반',
};

// 버스 타입별 색상 클래스 (경기도 도착정보 API routeTypeCd 기준)
export const BUS_TYPE_COLORS: Record<number, string> = {
  // 서울시 버스 타입
  1: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', // 지선
  2: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', // 좌석
  3: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200', // 마을
  4: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', // 광역
  5: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200', // 공항
  6: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', // 간선
  // 경기도 시내버스
  11: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', // 직행좌석
  12: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', // 좌석
  13: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', // 일반
  14: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', // 광역급행
  15: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', // 따복
  16: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', // 경기순환
  17: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', // 직행좌석
  // 경기도 농어촌버스
  21: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', // 직행좌석
  22: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', // 좌석
  23: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', // 일반
  // 마을버스
  30: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200', // 마을
  // 시외버스
  41: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', // 고속
  42: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', // 좌석시외
  43: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', // 일반시외
  // 공항버스
  51: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200', // 리무진
  52: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200', // 좌석공항
  53: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200', // 일반공항
};

function getApiKey(): string {
  const apiKey = process.env.TRAFFIC_API_KEY;
  if (!apiKey) {
    throw new Error('TRAFFIC_API_KEY 환경 변수가 설정되지 않았습니다.');
  }
  return apiKey;
}

/**
 * 서울시 버스 도착 정보 조회 (arsId 기반)
 * arsId: 정류소 고유번호 (5자리)
 */
export async function getSeoulBusArrival(arsId: string): Promise<BusArrivalInfo[]> {
  const apiKey = getApiKey();

  // arsId 포맷 정리 (하이픈 제거)
  const cleanArsId = arsId.replace(/-/g, '');

  // 서울시 API는 인코딩된 키를 사용
  const url = `http://ws.bus.go.kr/api/rest/stationinfo/getStationByUid?serviceKey=${encodeURIComponent(apiKey)}&arsId=${cleanArsId}`;

  try {
    const response = await fetch(url);
    const text = await response.text();

    // 에러 응답 체크
    if (text.includes('headerCd>') && !text.includes('<headerCd>0</headerCd>')) {
      const errorMatch = text.match(/<headerMsg>([^<]+)<\/headerMsg>/);
      const errorMsg = errorMatch?.[1] || 'Unknown error';
      console.error('[Seoul Bus API] Error:', errorMsg);

      // 인증 실패 시 빈 배열 반환 (폴백 처리를 위해)
      if (errorMsg.includes('인증') || errorMsg.includes('KEY')) {
        return [];
      }
    }

    // XML 파싱
    const arrivals: BusArrivalInfo[] = [];

    // 간단한 XML 파싱 (itemList 추출)
    const itemRegex = /<itemList>([\s\S]*?)<\/itemList>/g;
    let match;

    while ((match = itemRegex.exec(text)) !== null) {
      const item = match[1];

      const getValue = (tag: string): string => {
        const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`);
        const m = item.match(regex);
        return m ? m[1] : '';
      };

      const rtNm = getValue('rtNm'); // 노선명
      const busRouteId = getValue('busRouteId'); // 노선 ID
      const routeType = getValue('routeType'); // 노선 유형 (1:공항, 2:마을, 3:간선, 4:지선, 5:순환, 6:광역, 7:인천, 8:경기, 9:폐지, 0:공용)
      const arrmsg1 = getValue('arrmsg1'); // 첫번째 도착 메시지
      const arrmsg2 = getValue('arrmsg2'); // 두번째 도착 메시지
      const traTime1 = getValue('traTime1'); // 첫번째 도착 예정 시간(초)
      const traTime2 = getValue('traTime2');
      const plainNo1 = getValue('plainNo1'); // 차량번호
      const plainNo2 = getValue('plainNo2');
      const busType1 = getValue('busType1'); // 버스 차량 타입 (0:일반, 1:저상, 2:굴절)
      const busType2 = getValue('busType2');
      const reride_Num1 = getValue('reride_Num1'); // 재승차인원(혼잡도 관련)
      const reride_Num2 = getValue('reride_Num2');
      const stNm = getValue('stNm'); // 정류소명
      const nxtStn = getValue('nxtStn'); // 다음 정류소
      const congetion1 = getValue('congetion1'); // 혼잡도 (3:여유, 4:보통, 5:혼잡, 6:매우혼잡)
      const congetion2 = getValue('congetion2');
      const sectNm = getValue('sectNm'); // 구간 정보
      const staOrd1 = getValue('staOrd1'); // 첫번째 버스 남은 정류장 수
      const staOrd2 = getValue('staOrd2'); // 두번째 버스 남은 정류장 수

      if (rtNm) {
        // 도착 시간 파싱 (arrmsg에서 추출: "3분12초후[5번째 전]" 형식)
        const parseArrivalTime = (msg: string): number => {
          if (!msg || msg.includes('운행종료') || msg.includes('출발대기')) return -1;

          const minMatch = msg.match(/(\d+)분/);
          const secMatch = msg.match(/(\d+)초/);

          let totalSec = 0;
          if (minMatch) totalSec += parseInt(minMatch[1]) * 60;
          if (secMatch) totalSec += parseInt(secMatch[1]);

          return totalSec || (traTime1 ? parseInt(traTime1) : -1);
        };

        const time1 = parseArrivalTime(arrmsg1);
        const time2 = parseArrivalTime(arrmsg2);

        // 서울시 혼잡도 값 변환 (3:여유->1, 4:보통->2, 5:혼잡->3, 6:매우혼잡->4)
        const convertSeoulCrowded = (val: string): number | undefined => {
          const num = parseInt(val);
          if (num >= 3 && num <= 6) return num - 2; // 3->1, 4->2, 5->3, 6->4
          return undefined;
        };

        // 남은 정류장 수 파싱 (arrmsg에서 "[N번째 전]" 추출)
        const parseLeftStation = (msg: string, staOrd: string): number => {
          if (staOrd) return parseInt(staOrd) || 0;
          const match = msg.match(/\[(\d+)번째/);
          return match ? parseInt(match[1]) : 0;
        };

        // 서울시 routeType 변환 (1:공항, 2:마을, 3:간선, 4:지선, 5:순환, 6:광역, 7:인천, 8:경기)
        // -> 내부 타입 (5:공항, 3:마을, 6:간선급행, 1:일반, 4:직행/광역)
        const convertSeoulRouteType = (type: string): number | undefined => {
          const typeMap: Record<string, number> = {
            '1': 5,  // 공항
            '2': 3,  // 마을
            '3': 6,  // 간선 (파랑)
            '4': 1,  // 지선 (초록)
            '5': 1,  // 순환 (노랑) -> 일반으로 처리
            '6': 4,  // 광역 (빨강)
            '7': 1,  // 인천
            '8': 1,  // 경기
          };
          return typeMap[type];
        };

        if (time1 > 0) {
          arrivals.push({
            routeName: rtNm,
            routeId: busRouteId || undefined,
            routeType: convertSeoulRouteType(routeType),
            predictTime1: Math.floor(time1 / 60),
            predictTimeSec1: time1,
            locationNo1: parseLeftStation(arrmsg1, staOrd1),
            plateNo1: plainNo1 || undefined,
            lowPlate1: busType1 === '1',
            crowded1: convertSeoulCrowded(congetion1),
            predictTime2: time2 > 0 ? Math.floor(time2 / 60) : undefined,
            predictTimeSec2: time2 > 0 ? time2 : undefined,
            locationNo2: time2 > 0 ? parseLeftStation(arrmsg2, staOrd2) : undefined,
            plateNo2: plainNo2 || undefined,
            lowPlate2: busType2 === '1',
            crowded2: time2 > 0 ? convertSeoulCrowded(congetion2) : undefined,
            stationName: stNm || undefined,
            direction: nxtStn ? `${nxtStn} 방면` : undefined,
          });
        }
      }
    }

    // 도착 시간순 정렬
    arrivals.sort((a, b) => (a.predictTimeSec1 || 0) - (b.predictTimeSec1 || 0));

    return arrivals;
  } catch (error) {
    console.error('Seoul bus arrival API error:', error);
    return [];
  }
}

/**
 * 경기도 정류소 번호(mobileNo/arsId)로 stationId 조회
 */
async function getGyeonggiStationId(mobileNo: string): Promise<string | null> {
  const apiKey = getApiKey();
  const url = `https://apis.data.go.kr/6410000/busstationservice/v2/getBusStationListv2?serviceKey=${encodeURIComponent(apiKey)}&keyword=${mobileNo}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const stationList = data?.response?.msgBody?.busStationList;
    if (!stationList) return null;

    // 배열 또는 단일 객체 처리
    const stations = Array.isArray(stationList) ? stationList : [stationList];

    // mobileNo가 정확히 일치하는 정류소 찾기
    const station = stations.find((s: any) => s.mobileNo?.trim() === mobileNo);
    return station?.stationId ? String(station.stationId) : null;
  } catch (error) {
    console.error('Gyeonggi station search error:', error);
    return null;
  }
}

/**
 * 경기도 버스 도착 정보 조회 (stationId 기반)
 * stationId: 경기도 정류소 ID
 * API 문서: https://www.data.go.kr/data/15080346/openapi.do
 */
export async function getGyeonggiBusArrival(stationId: string): Promise<BusArrivalInfo[]> {
  const apiKey = getApiKey();

  // v2 API 엔드포인트 사용 (JSON 형식으로 요청)
  const url = `https://apis.data.go.kr/6410000/busarrivalservice/v2/getBusArrivalListv2?serviceKey=${encodeURIComponent(apiKey)}&stationId=${stationId}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    const arrivals: BusArrivalInfo[] = [];
    const arrivalList = data?.response?.msgBody?.busArrivalList;
    if (!arrivalList) return [];

    const items = Array.isArray(arrivalList) ? arrivalList : [arrivalList];

    for (const item of items) {
      const routeName = item.routeName || item.routeNm;
      const routeTypeCd = item.routeTypeCd || item.routeType;
      const predictTime1 = parseInt(item.predictTime1) || 0;
      const predictTimeSec1 = parseInt(item.predictTimeSec1) || predictTime1 * 60;

      // 디버깅 로그
      if (routeName) {
        console.log(`[Gyeonggi Arrival] ${routeName}: routeTypeCd=${routeTypeCd}`);
      }

      if (routeName && predictTime1 > 0) {
        const parsedRouteType = routeTypeCd ? parseInt(routeTypeCd) : undefined;

        arrivals.push({
          routeName,
          routeId: item.routeId ? String(item.routeId) : undefined,
          routeType: parsedRouteType,
          predictTime1,
          predictTimeSec1,
          locationNo1: item.locationNo1 ? parseInt(item.locationNo1) : undefined,
          remainSeat1: item.remainSeatCnt1 !== '-1' && item.remainSeatCnt1 ? parseInt(item.remainSeatCnt1) : undefined,
          plateNo1: item.plateNo1 || undefined,
          lowPlate1: item.lowPlate1 === '1' || item.lowPlate1 === 1,
          crowded1: item.crowded1 ? parseInt(item.crowded1) : undefined,
          predictTime2: item.predictTime2 ? parseInt(item.predictTime2) : undefined,
          predictTimeSec2: item.predictTimeSec2 ? parseInt(item.predictTimeSec2) : undefined,
          locationNo2: item.locationNo2 ? parseInt(item.locationNo2) : undefined,
          remainSeat2: item.remainSeatCnt2 !== '-1' && item.remainSeatCnt2 ? parseInt(item.remainSeatCnt2) : undefined,
          plateNo2: item.plateNo2 || undefined,
          lowPlate2: item.lowPlate2 === '1' || item.lowPlate2 === 1,
          crowded2: item.crowded2 ? parseInt(item.crowded2) : undefined,
          direction: item.stationNm1 || undefined,
        });
      }
    }

    // 도착 시간순 정렬
    arrivals.sort((a, b) => (a.predictTimeSec1 || 0) - (b.predictTimeSec1 || 0));

    return arrivals;
  } catch (error) {
    console.error('Gyeonggi bus arrival API error:', error);
    return [];
  }
}

/**
 * 정류소 ID/번호를 기반으로 적절한 API 호출
 * - arsId가 5자리 숫자면 서울시 API
 * - arsId가 있고 서울이 아니면 경기도 API (mobileNo로 stationId 조회)
 * - stationId가 200000xxx 형식이면 경기도 API
 */
export async function getBusArrival(
  stationId: string,
  arsId?: string
): Promise<BusArrivalInfo[]> {
  // arsId가 있는 경우
  if (arsId) {
    const cleanArsId = arsId.replace(/-/g, '');

    // 서울시 arsId는 5자리 숫자 (앞자리가 0~2)
    // 현재 서울시 API 키 인증 문제로 비활성화 - 경기도 API 또는 ODSay로 폴백
    // TODO: 서울시 버스 API 키 등록 후 활성화
    /*
    if (/^\d{5}$/.test(cleanArsId) && ['0', '1', '2'].includes(cleanArsId[0])) {
      const seoulResult = await getSeoulBusArrival(cleanArsId);
      if (seoulResult.length > 0) {
        return seoulResult;
      }
    }
    */

    // 경기도 정류소 번호(mobileNo)로 stationId 조회
    if (/^\d{5}$/.test(cleanArsId)) {
      const gyeonggiStationId = await getGyeonggiStationId(cleanArsId);
      if (gyeonggiStationId) {
        return getGyeonggiBusArrival(gyeonggiStationId);
      }
    }
  }

  // stationId가 경기도 형식(9자리 숫자)이면 경기도 API
  if (stationId && /^\d{9}$/.test(stationId)) {
    return getGyeonggiBusArrival(stationId);
  }

  // 그 외는 빈 배열 반환 (ODSay API로 폴백 가능)
  return [];
}
