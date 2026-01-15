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

interface MyPlace {
  id: string;
  name: string;
  place_name: string;
  address: string | null;
  x: string;
  y: string;
  icon: 'home' | 'office' | 'pin';
}

interface PlaceSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: Place) => void;
  placeholder?: string;
  label?: string;
  labelColor?: string;
  className?: string;
  showMyPlaces?: boolean;
}

const ICON_MAP = {
  home: '🏠',
  office: '🏢',
  pin: '📍',
};

export function PlaceSearchInput({
  value,
  onChange,
  onSelect,
  placeholder,
  label,
  labelColor = 'text-primary',
  className,
  showMyPlaces = true,
}: PlaceSearchInputProps) {
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [myPlaces, setMyPlaces] = useState<MyPlace[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(undefined);
  const justSelectedRef = useRef(false);

  // 내 장소 불러오기
  useEffect(() => {
    if (!showMyPlaces) return;

    const fetchMyPlaces = async () => {
      try {
        const response = await fetch('/api/my-places');
        const data = await response.json();
        setMyPlaces(data.places || []);
      } catch (error) {
        console.error('Failed to fetch my places:', error);
      }
    };

    fetchMyPlaces();
  }, [showMyPlaces]);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/places?query=${encodeURIComponent(query)}`);
      const data = await response.json();
      setSuggestions(data.places || []);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
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

  // 포커스/검색어에 따라 드롭다운 열기
  useEffect(() => {
    const hasContent = suggestions.length > 0 || (myPlaces.length > 0 && value.length < 2);
    setIsOpen(isFocused && hasContent);
  }, [isFocused, suggestions, myPlaces, value]);

  // 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const handleSelectPlace = (place: Place) => {
    justSelectedRef.current = true;
    onChange(place.name);
    onSelect(place);
    setIsOpen(false);
    setSuggestions([]);
    setIsFocused(false);
    inputRef.current?.blur();
  };

  const handleSelectMyPlace = (myPlace: MyPlace) => {
    const place: Place = {
      id: myPlace.id,
      name: myPlace.place_name,
      address: myPlace.address || '',
      roadAddress: myPlace.address || '',
      category: myPlace.name,
      x: myPlace.x,
      y: myPlace.y,
    };
    handleSelectPlace(place);
  };

  // 필터링된 내 장소 (검색어가 있으면 필터링)
  const filteredMyPlaces = value.length >= 2
    ? myPlaces.filter(
        (mp) =>
          mp.name.toLowerCase().includes(value.toLowerCase()) ||
          mp.place_name.toLowerCase().includes(value.toLowerCase())
      )
    : myPlaces;

  const totalItems = filteredMyPlaces.length + suggestions.length;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || totalItems === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < totalItems - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < totalItems) {
          e.preventDefault();
          if (selectedIndex < filteredMyPlaces.length) {
            handleSelectMyPlace(filteredMyPlaces[selectedIndex]);
          } else {
            handleSelectPlace(suggestions[selectedIndex - filteredMyPlaces.length]);
          }
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const showMyPlacesSection = filteredMyPlaces.length > 0;
  const showSuggestionsSection = suggestions.length > 0;

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
          onFocus={() => setIsFocused(true)}
          className="pr-14"
          autoComplete="off"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <LoadingSpinner className="h-4 w-4 text-muted-foreground" />
          )}
          {label && (
            <span className={cn('text-xs font-semibold', labelColor)}>
              {label}
            </span>
          )}
        </div>
      </div>

      {isOpen && (showMyPlacesSection || showSuggestionsSection) && (
        <div className="absolute left-0 right-0 z-[100] mt-1">
          <ul className="w-full max-h-60 overflow-auto rounded-lg border border-border bg-background shadow-xl">
            {/* 내 장소 섹션 */}
            {showMyPlacesSection && (
              <>
                <li className="px-3 py-1.5 bg-muted/50 border-b border-border">
                  <span className="text-xs font-semibold text-muted-foreground">내 장소</span>
                </li>
                {filteredMyPlaces.map((myPlace, index) => (
                  <li
                    key={`my-${myPlace.id}`}
                    onClick={() => handleSelectMyPlace(myPlace)}
                    className={cn(
                      'cursor-pointer px-3 py-2.5 border-b border-border/50 transition-colors',
                      'hover:bg-accent',
                      selectedIndex === index && 'bg-accent'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{ICON_MAP[myPlace.icon]}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{myPlace.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {myPlace.place_name}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </>
            )}

            {/* 검색 결과 섹션 */}
            {showSuggestionsSection && (
              <>
                {showMyPlacesSection && (
                  <li className="px-3 py-1.5 bg-muted/50 border-b border-border">
                    <span className="text-xs font-semibold text-muted-foreground">검색 결과</span>
                  </li>
                )}
                {suggestions.map((place, index) => {
                  const adjustedIndex = filteredMyPlaces.length + index;
                  return (
                    <li
                      key={place.id}
                      onClick={() => handleSelectPlace(place)}
                      className={cn(
                        'cursor-pointer px-3 py-2.5 border-b border-border/50 last:border-b-0 transition-colors',
                        'hover:bg-accent',
                        selectedIndex === adjustedIndex && 'bg-accent'
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
                  );
                })}
              </>
            )}
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
