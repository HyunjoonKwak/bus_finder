'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import type { BusLaneInfo } from '@/lib/odsay/types';
import { BUS_TYPE_MAP } from '@/lib/odsay/types';

interface BusSearchInputProps {
  onSelect: (bus: BusLaneInfo) => void;
  placeholder?: string;
  className?: string;
}

export function BusSearchInput({
  onSelect,
  placeholder = '버스 번호를 입력하세요',
  className,
}: BusSearchInputProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BusLaneInfo[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/odsay/bus/search?q=${encodeURIComponent(query)}`
        );
        const data = await response.json();
        setResults(data.buses || []);
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

  const handleSelect = (bus: BusLaneInfo) => {
    setQuery(bus.busNo);
    setIsOpen(false);
    onSelect(bus);
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
            {results.map((bus) => (
              <li
                key={bus.busID}
                className="px-3 py-2 hover:bg-slate-100 cursor-pointer"
                onClick={() => handleSelect(bus)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-900">
                    {bus.busNo}
                  </span>
                  <span className="text-xs text-slate-500">
                    {BUS_TYPE_MAP[bus.type] || '버스'}
                  </span>
                </div>
                {bus.busStartPoint && bus.busEndPoint && (
                  <p className="text-xs text-slate-500 mt-1">
                    {bus.busStartPoint} → {bus.busEndPoint}
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
