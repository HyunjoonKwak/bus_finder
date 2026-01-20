'use client';

import { useState, useCallback } from 'react';
import type { StationPair } from '@/types/stats';

interface UseTrackingPairsOptions {
  busId: string | null;
  stationId: string | null;
}

interface UseTrackingPairsReturn {
  pairs: StationPair[];
  loading: boolean;
  fetchPairs: () => Promise<void>;
  deletePair: (pairId: string) => void;
}

export function useTrackingPairs({
  busId,
  stationId,
}: UseTrackingPairsOptions): UseTrackingPairsReturn {
  const [pairs, setPairs] = useState<StationPair[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPairs = useCallback(async () => {
    if (!busId) return;

    try {
      setLoading(true);
      const response = await fetch(`/api/tracking/pairs?busId=${busId}`);

      if (response.ok) {
        const data = await response.json();
        // 현재 정류장이 포함된 페어만 필터링
        const relevantPairs = (data.pairs || []).filter(
          (p: StationPair) => p.stationA.id === stationId || p.stationB.id === stationId
        );
        setPairs(relevantPairs);
      }
    } catch {
      // 페어 로드 실패는 무시
    } finally {
      setLoading(false);
    }
  }, [busId, stationId]);

  const deletePair = useCallback((pairId: string) => {
    setPairs((prev) => prev.filter((p) => p.id !== pairId));
  }, []);

  return {
    pairs,
    loading,
    fetchPairs,
    deletePair,
  };
}
