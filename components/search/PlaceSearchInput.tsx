'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface Place {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  category: string;
  x: string;
  y: string;
}

interface PlaceSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: Place) => void;
  placeholder?: string;
  label?: string;
  labelColor?: string;
  className?: string;
}

export function PlaceSearchInput({
  value,
  onChange,
  onSelect,
  placeholder,
  label,
  labelColor = 'text-primary',
  className,
}: PlaceSearchInputProps) {
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);
  const justSelectedRef = useRef(false); // 방금 선택했는지 여부

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/places?query=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSuggestions(data.places || []);
      setIsOpen((data.places || []).length > 0);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // 방금 선택한 경우 검색 스킵
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, fetchSuggestions]);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleSelectPlace = (place: Place) => {
    justSelectedRef.current = true; // 선택 후 재검색 방지
    onChange(place.name);
    onSelect(place);
    setIsOpen(false);
    setSuggestions([]);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          e.preventDefault();
          handleSelectPlace(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          className="pr-14"
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <LoadingSpinner className="h-4 w-4 text-muted-foreground" />
          )}
          {label && (
            <span className={cn(
              'text-xs font-semibold',
              labelColor
            )}>
              {label}
            </span>
          )}
        </div>
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute left-0 right-0 z-[100] mt-1">
          <ul className="w-full max-h-60 overflow-auto rounded-lg border border-border bg-background shadow-xl">
            {suggestions.map((place, index) => (
              <li
                key={place.id}
                onClick={() => handleSelectPlace(place)}
                className={cn(
                  'cursor-pointer px-3 py-2.5 border-b border-border/50 last:border-b-0 transition-colors',
                  'hover:bg-accent',
                  selectedIndex === index && 'bg-accent'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{place.name}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {place.roadAddress || place.address}
                    </p>
                  </div>
                  {place.category && (
                    <span className="flex-shrink-0 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {place.category}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
