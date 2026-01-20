'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface TrackingTarget {
  id: string;
  bus_id: string;
  bus_no: string;
  station_id: string;
  station_name: string;
  ars_id: string | null;
}

interface PairSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  preSelectedBusId?: string;
  preSelectedBusNo?: string;
}

export function PairSetupModal({
  isOpen,
  onClose,
  onSuccess,
  preSelectedBusId,
  preSelectedBusNo,
}: PairSetupModalProps) {
  const [targets, setTargets] = useState<TrackingTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // 선택 상태
  const [selectedBusId, setSelectedBusId] = useState<string | null>(preSelectedBusId || null);
  const [stationA, setStationA] = useState<TrackingTarget | null>(null);
  const [stationB, setStationB] = useState<TrackingTarget | null>(null);
  const [pairName, setPairName] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchTargets();
    }
  }, [isOpen]);

  useEffect(() => {
    if (preSelectedBusId) {
      setSelectedBusId(preSelectedBusId);
    }
  }, [preSelectedBusId]);

  const fetchTargets = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tracking/targets');
      const data = await response.json();
      setTargets(data.targets || []);
    } catch {
      console.error('Failed to fetch targets');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBusId || !stationA || !stationB) return;

    const busTarget = targets.find((t) => t.bus_id === selectedBusId);
    if (!busTarget) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/tracking/pairs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          busId: selectedBusId,
          busNo: busTarget.bus_no,
          stationA: {
            id: stationA.station_id,
            name: stationA.station_name,
            arsId: stationA.ars_id,
          },
          stationB: {
            id: stationB.station_id,
            name: stationB.station_name,
            arsId: stationB.ars_id,
          },
          name: pairName || null,
        }),
      });

      if (response.ok) {
        onSuccess();
        handleClose();
      } else {
        const data = await response.json();
        alert(data.error || '페어 생성에 실패했습니다.');
      }
    } catch {
      alert('오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedBusId(preSelectedBusId || null);
    setStationA(null);
    setStationB(null);
    setPairName('');
    onClose();
  };

  if (!isOpen) return null;

  // 버스별 그룹화
  const busList = Array.from(new Set(targets.map((t) => t.bus_id))).map((busId) => {
    const target = targets.find((t) => t.bus_id === busId);
    return { busId, busNo: target?.bus_no || '' };
  });

  // 선택된 버스의 정류장 목록
  const stationsForBus = selectedBusId
    ? targets.filter((t) => t.bus_id === selectedBusId)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">페어 정류장 설정</h2>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : targets.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">추적 중인 버스가 없습니다.</p>
            <p className="text-sm text-muted-foreground mt-2">
              먼저 버스 추적을 추가해주세요.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 버스 선택 */}
            <div>
              <label className="block text-sm font-medium mb-2">버스 선택</label>
              <select
                value={selectedBusId || ''}
                onChange={(e) => {
                  setSelectedBusId(e.target.value || null);
                  setStationA(null);
                  setStationB(null);
                }}
                className="w-full p-2 border border-border rounded-md bg-background"
              >
                <option value="">버스를 선택하세요</option>
                {busList.map(({ busId, busNo }) => (
                  <option key={busId} value={busId}>
                    {busNo}
                  </option>
                ))}
              </select>
            </div>

            {selectedBusId && stationsForBus.length < 2 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  이 버스에 대해 2개 이상의 정류장을 추적해야 페어를 설정할 수 있습니다.
                </p>
              </div>
            )}

            {/* 정류장 A 선택 */}
            {selectedBusId && stationsForBus.length >= 2 && (
              <div>
                <label className="block text-sm font-medium mb-2">출발 정류장 (A)</label>
                <select
                  value={stationA?.station_id || ''}
                  onChange={(e) => {
                    const station = stationsForBus.find((s) => s.station_id === e.target.value);
                    setStationA(station || null);
                    if (station && stationB?.station_id === station.station_id) {
                      setStationB(null);
                    }
                  }}
                  className="w-full p-2 border border-border rounded-md bg-background"
                >
                  <option value="">정류장 A를 선택하세요</option>
                  {stationsForBus.map((station) => (
                    <option key={station.station_id} value={station.station_id}>
                      {station.station_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 정류장 B 선택 */}
            {stationA && (
              <div>
                <label className="block text-sm font-medium mb-2">도착 정류장 (B)</label>
                <select
                  value={stationB?.station_id || ''}
                  onChange={(e) => {
                    const station = stationsForBus.find((s) => s.station_id === e.target.value);
                    setStationB(station || null);
                  }}
                  className="w-full p-2 border border-border rounded-md bg-background"
                >
                  <option value="">정류장 B를 선택하세요</option>
                  {stationsForBus
                    .filter((s) => s.station_id !== stationA.station_id)
                    .map((station) => (
                      <option key={station.station_id} value={station.station_id}>
                        {station.station_name}
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* 페어 이름 (선택) */}
            {stationA && stationB && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  페어 이름 <span className="text-muted-foreground">(선택)</span>
                </label>
                <input
                  type="text"
                  value={pairName}
                  onChange={(e) => setPairName(e.target.value)}
                  placeholder="예: 출근길, 퇴근길"
                  className="w-full p-2 border border-border rounded-md bg-background"
                />
              </div>
            )}

            {/* 미리보기 */}
            {stationA && stationB && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm font-medium mb-1">
                  {pairName || '페어 설정'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {stationA.station_name} → {stationB.station_name}
                </p>
              </div>
            )}

            {/* 버튼 */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                취소
              </Button>
              <Button
                className="flex-1"
                onClick={handleSubmit}
                disabled={!stationA || !stationB || submitting}
              >
                {submitting ? '저장 중...' : '페어 생성'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
