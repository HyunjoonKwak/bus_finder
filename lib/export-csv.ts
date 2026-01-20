import type { ArrivalLog } from '@/types/stats';

interface ExportStatsToCSVOptions {
  busId: string;
  stationId: string;
  days: number;
  busNo: string;
  stationName: string;
}

/**
 * 도착 기록을 CSV 파일로 내보내기
 */
export async function exportStatsToCSV({
  busId,
  stationId,
  days,
  busNo,
  stationName,
}: ExportStatsToCSVOptions): Promise<void> {
  // 전체 로그 데이터 가져오기
  const response = await fetch(
    `/api/tracking/stats?bus_id=${busId}&station_id=${stationId}&days=${days}&page=1&limit=10000`
  );

  if (!response.ok) {
    throw new Error('데이터를 가져오는데 실패했습니다.');
  }

  const data = await response.json();
  const allLogs: ArrivalLog[] = data.stats.recentLogs;

  // CSV 헤더
  const headers = ['날짜', '시간', '요일', '차량번호'];
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

  // CSV 데이터 생성
  const csvRows = [headers.join(',')];
  allLogs.forEach((log) => {
    const date = new Date(log.arrival_time);
    const dateStr = date.toLocaleDateString('ko-KR');
    const timeStr = date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const dayName = dayNames[log.day_of_week];
    const plateNo = log.plate_no || '';
    csvRows.push([dateStr, timeStr, dayName, plateNo].join(','));
  });

  // 다운로드
  const csvContent = '\uFEFF' + csvRows.join('\n'); // BOM for Excel
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${busNo}_${stationName}_도착기록_${days}일.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
