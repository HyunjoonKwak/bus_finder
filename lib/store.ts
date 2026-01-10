import { create } from 'zustand';
import { SearchFilters, Location } from '@/types';

interface SearchState {
  origin: Location | null;
  destination: Location | null;
  filters: SearchFilters;
  recentSearches: { origin: string; destination: string }[];
  setOrigin: (origin: Location | null) => void;
  setDestination: (destination: Location | null) => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  addRecentSearch: (origin: string, destination: string) => void;
  clearSearch: () => void;
  clearSearches: () => void;
}

const defaultFilters: SearchFilters = {
  minimizeWalk: false,
  minimizeTransfer: false,
  hasLuggage: false,
  isRainy: false,
};

export const useSearchStore = create<SearchState>((set) => ({
  origin: null,
  destination: null,
  filters: defaultFilters,
  recentSearches: [],

  setOrigin: (origin) => set({ origin }),

  setDestination: (destination) => set({ destination }),

  setFilters: (filters) =>
    set((state) => ({
      filters: { ...state.filters, ...filters },
    })),

  addRecentSearch: (origin, destination) =>
    set((state) => {
      const newSearch = { origin, destination };
      const filtered = state.recentSearches.filter(
        (s) => s.origin !== origin || s.destination !== destination
      );
      return {
        recentSearches: [newSearch, ...filtered].slice(0, 5),
      };
    }),

  clearSearch: () =>
    set({
      origin: null,
      destination: null,
      filters: defaultFilters,
    }),

  clearSearches: () =>
    set({
      recentSearches: [],
    }),
}));
