'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import type { StationInfo } from '@/lib/odsay/types';

interface StationSearchInputProps {
  onSelect: (station: StationInfo) => void;
  placeholder?: string;
  className?: string;
}

export function StationSearchInput({
  onSelect,
  placeholder = '정류소명을 입력하세요',
  className,
}: StationSearchInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StationInfo[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/odsay/station/search?q=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        setResults(data.stations || []);
        setIsOpen(true);
      } catch (error) {
        console.error('Search error:', error);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  const handleSelect = (station: StationInfo) => {
    setQuery(station.stationName);
    setIsOpen(false);
    onSelect(station);
  };

  return (
    <div className={`relative ${className || ''}`}>
      <Input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        onFocus={() => results.length > 0 && setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {isOpen && results.length > 0 && (
        <Card className="absolute z-50 w-full mt-1 max-h-60 overflow-y-auto shadow-lg">
          <ul className="py-1">
            {results.map((station) => (
              <li
                key={station.stationID}
                className="px-3 py-2 hover:bg-slate-100 cursor-pointer"
                onClick={() => handleSelect(station)}
              >
                <p className="font-medium text-slate-900">
                  {station.stationName}
                </p>
                {station.arsID && (
                  <p className="text-xs text-slate-500">
                    정류소 번호: {station.arsID}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
