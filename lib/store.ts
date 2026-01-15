import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SearchFilters, Location } from '@/types';

interface RecentSearch {
  origin: string;
  destination: string;
  sx?: string;
  sy?: string;
  ex?: string;
  ey?: string;
}

// 최근 정류소 검색
export interface RecentStation {
  stationId: string;
  stationName: string;
  arsId?: string;
  x?: string;
  y?: string;
}

// 최근 노선 검색
export interface RecentRoute {
  busId: string;
  busNo: string;
  busType?: number;
  subInfo?: string; // 기점 → 종점
}

// 내 장소 타입
export interface MyPlace {
  id: string;
  name: string;
  placeName: string;
  address?: string;
  x: string;
  y: string;
  icon: 'home' | 'office' | 'pin';
  sortOrder: number;
}

interface SearchState {
  origin: Location | null;
  destination: Location | null;
  filters: SearchFilters;
  recentSearches: RecentSearch[];
  recentStations: RecentStation[];
  recentRoutes: RecentRoute[];
  setOrigin: (origin: Location | null) => void;
  setDestination: (destination: Location | null) => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  addRecentSearch: (search: RecentSearch) => void;
  removeRecentSearch: (index: number) => void;
  addRecentStation: (station: RecentStation) => void;
  removeRecentStation: (stationId: string) => void;
  clearRecentStations: () => void;
  addRecentRoute: (route: RecentRoute) => void;
  removeRecentRoute: (busId: string) => void;
  clearRecentRoutes: () => void;
  clearSearch: () => void;
  clearSearches: () => void;
}

const defaultFilters: SearchFilters = {
  minimizeWalk: false,
  minimizeTransfer: false,
  hasLuggage: false,
  isRainy: false,
};

export const useSearchStore = create<SearchState>()(
  persist(
    (set) => ({
      origin: null,
      destination: null,
      filters: defaultFilters,
      recentSearches: [],
      recentStations: [],
      recentRoutes: [],

      setOrigin: (origin) => set({ origin }),

      setDestination: (destination) => set({ destination }),

      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),

      addRecentSearch: (search) =>
        set((state) => {
          const filtered = state.recentSearches.filter(
            (s) => s.origin !== search.origin || s.destination !== search.destination
          );
          return {
            recentSearches: [search, ...filtered].slice(0, 10),
          };
        }),

      removeRecentSearch: (index) =>
        set((state) => ({
          recentSearches: state.recentSearches.filter((_, i) => i !== index),
        })),

      addRecentStation: (station) =>
        set((state) => {
          const filtered = state.recentStations.filter(
            (s) => s.stationId !== station.stationId
          );
          return {
            recentStations: [station, ...filtered].slice(0, 20),
          };
        }),

      removeRecentStation: (stationId) =>
        set((state) => ({
          recentStations: state.recentStations.filter(
            (s) => s.stationId !== stationId
          ),
        })),

      clearRecentStations: () =>
        set({ recentStations: [] }),

      addRecentRoute: (route) =>
        set((state) => {
          const filtered = state.recentRoutes.filter(
            (r) => r.busId !== route.busId
          );
          return {
            recentRoutes: [route, ...filtered].slice(0, 20),
          };
        }),

      removeRecentRoute: (busId) =>
        set((state) => ({
          recentRoutes: state.recentRoutes.filter((r) => r.busId !== busId),
        })),

      clearRecentRoutes: () =>
        set({ recentRoutes: [] }),

      clearSearch: () =>
        set({
          origin: null,
          destination: null,
          filters: defaultFilters,
        }),

      clearSearches: () =>
        set({
          recentSearches: [],
          recentStations: [],
          recentRoutes: [],
        }),
    }),
    {
      name: 'search-storage',
      partialize: (state) => ({
        recentSearches: state.recentSearches,
        recentStations: state.recentStations,
        recentRoutes: state.recentRoutes,
      }),
    }
  )
);
