/**
 * 내 장소 관련 타입 정의
 *
 * DB (snake_case) <-> Frontend (camelCase) 변환 포함
 */

/** 아이콘 타입 */
export type PlaceIcon = 'home' | 'office' | 'pin';

/** DB 형식 (API 응답) */
export interface MyPlaceDB {
  id: string;
  user_id: string;
  name: string;
  place_name: string;
  address: string | null;
  x: string;
  y: string;
  icon: PlaceIcon;
  sort_order: number;
  created_at: string;
}

/** Frontend 형식 (클라이언트 사용) */
export interface MyPlace {
  id: string;
  name: string;
  placeName: string;
  address?: string;
  x: string;
  y: string;
  icon: PlaceIcon;
  sortOrder: number;
}

/** DB -> Frontend 변환 */
export function toFrontendMyPlace(db: MyPlaceDB): MyPlace {
  return {
    id: db.id,
    name: db.name,
    placeName: db.place_name,
    address: db.address || undefined,
    x: db.x,
    y: db.y,
    icon: db.icon,
    sortOrder: db.sort_order,
  };
}

/** Frontend -> DB 변환 (생성/수정용) */
export function toDbMyPlace(
  place: Omit<MyPlace, 'id'>,
  userId: string
): Omit<MyPlaceDB, 'id' | 'created_at'> {
  return {
    user_id: userId,
    name: place.name,
    place_name: place.placeName,
    address: place.address || null,
    x: place.x,
    y: place.y,
    icon: place.icon,
    sort_order: place.sortOrder,
  };
}

/** 아이콘 매핑 상수 */
export const PLACE_ICONS: Record<PlaceIcon, { icon: string; label: string }> = {
  home: { icon: '🏠', label: '집' },
  office: { icon: '🏢', label: '회사' },
  pin: { icon: '📍', label: '기타' },
};
