'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { RealtimeArrivalInfo } from '@/lib/odsay/types';
import type { ArrivalApiItem } from '@/types/bus-page';

interface UseStationArrivalsOptions {
  stationId: string | null;
  arsId?: string;
  refreshInterval?: number;
}

interface UseStationArrivalsReturn {
  arrivals: RealtimeArrivalInfo[];
  loading: boolean;
  countdown: number;
  refresh: () => Promise<void>;
}

export function useStationArrivals({
  stationId,
  arsId,
  refreshInterval = 15,
}: UseStationArrivalsOptions): UseStationArrivalsReturn {
  const [arrivals, setArrivals] = useState<RealtimeArrivalInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(refreshInterval);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchArrivals = useCallback(async () => {
    if (!stationId) {
      setArrivals([]);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('stationId', stationId);
      if (arsId) params.set('arsId', arsId);

      const response = await fetch(`/api/bus/arrival?${params.toString()}`);
      const data = await response.json();

      if (!data.arrivals || data.arrivals.length === 0) {
        setArrivals([]);
        return;
      }

      const formattedArrivals: RealtimeArrivalInfo[] = data.arrivals.map((item: ArrivalApiItem) => ({
        routeId: item.routeId || '',
        routeNm: item.routeNm || '알수없음',
        arrivalSec1: item.predictTime1 ? item.predictTime1 * 60 : undefined,
        arrivalSec2: item.predictTime2 ? item.predictTime2 * 60 : undefined,
        leftStation1: item.locationNo1,
        leftStation2: item.locationNo2,
        vehicleNo1: item.vehicleNo1,
        vehicleNo2: item.vehicleNo2,
        lowPlate1: item.lowPlate1,
        lowPlate2: item.lowPlate2,
        crowded1: item.crowded1,
        crowded2: item.crowded2,
        busType: item.busType,
        routeType: item.routeType,
      }));

      setArrivals(formattedArrivals);
    } catch (error) {
      console.error('Fetch arrivals error:', error);
      setArrivals([]);
    } finally {
      setLoading(false);
      setCountdown(refreshInterval);
    }
  }, [stationId, arsId, refreshInterval]);

  // 카운트다운 타이머
  useEffect(() => {
    if (!stationId) return;

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          fetchArrivals();
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [stationId, fetchArrivals, refreshInterval]);

  // stationId 변경 시 즉시 fetch
  useEffect(() => {
    if (stationId) {
      fetchArrivals();
    } else {
      setArrivals([]);
    }
  }, [stationId, fetchArrivals]);

  return {
    arrivals,
    loading,
    countdown,
    refresh: fetchArrivals,
  };
}
