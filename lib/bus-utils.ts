import { BUS_TYPE_MAP } from '@/lib/odsay/types';

// 버스 타입별 색상 (서울/경기 통합)
export const BUS_TYPE_COLORS: Record<number, { bg: string; text: string; label: string }> = {
  // 서울시 버스 타입
  1: { bg: 'bg-green-500', text: 'text-white', label: '지선' },
  2: { bg: 'bg-green-600', text: 'text-white', label: '좌석' },
  3: { bg: 'bg-emerald-500', text: 'text-white', label: '마을' },
  4: { bg: 'bg-red-500', text: 'text-white', label: '광역' },
  5: { bg: 'bg-sky-500', text: 'text-white', label: '공항' },
  6: { bg: 'bg-blue-600', text: 'text-white', label: '간선' },
  // 경기도 시내버스
  11: { bg: 'bg-red-500', text: 'text-white', label: '직행좌석' },
  12: { bg: 'bg-green-600', text: 'text-white', label: '좌석' },
  13: { bg: 'bg-green-500', text: 'text-white', label: '일반' },
  14: { bg: 'bg-red-600', text: 'text-white', label: '광역급행' },
  15: { bg: 'bg-purple-500', text: 'text-white', label: '따복' },
  16: { bg: 'bg-blue-600', text: 'text-white', label: '경기순환' },
  17: { bg: 'bg-red-500', text: 'text-white', label: '직행좌석' },
  // 경기도 농어촌버스
  21: { bg: 'bg-red-500', text: 'text-white', label: '직행좌석' },
  22: { bg: 'bg-green-600', text: 'text-white', label: '좌석' },
  23: { bg: 'bg-green-500', text: 'text-white', label: '일반' },
  // 마을버스
  30: { bg: 'bg-emerald-500', text: 'text-white', label: '마을' },
  // 시외버스
  41: { bg: 'bg-purple-600', text: 'text-white', label: '고속' },
  42: { bg: 'bg-purple-500', text: 'text-white', label: '좌석시외' },
  43: { bg: 'bg-purple-500', text: 'text-white', label: '일반시외' },
  // 공항버스
  51: { bg: 'bg-sky-600', text: 'text-white', label: '리무진' },
  52: { bg: 'bg-sky-500', text: 'text-white', label: '좌석공항' },
  53: { bg: 'bg-sky-500', text: 'text-white', label: '일반공항' },
};

export const getBusTypeStyle = (type?: number) => {
  if (!type) return { bg: 'bg-blue-500', text: 'text-white', label: '버스' };
  return BUS_TYPE_COLORS[type] || { bg: 'bg-blue-500', text: 'text-white', label: BUS_TYPE_MAP[type] || '버스' };
};

export const getCrowdedInfo = (crowded?: number) => {
  if (!crowded) return null;
  const info: Record<number, { label: string; color: string; icon: string }> = {
    1: { label: '여유', color: 'text-green-500', icon: '🟢' },
    2: { label: '보통', color: 'text-yellow-500', icon: '🟡' },
    3: { label: '혼잡', color: 'text-orange-500', icon: '🟠' },
    4: { label: '매우혼잡', color: 'text-red-500', icon: '🔴' },
  };
  return info[crowded] || null;
};

export const formatArrivalTime = (seconds: number) => {
  if (seconds < 60) return '곧 도착';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}분`;
};
