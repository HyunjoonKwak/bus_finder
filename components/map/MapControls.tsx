'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function MapControls({ 
  onCurrentLocation, 
  onZoomIn, 
  onZoomOut 
}: { 
  onCurrentLocation: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="absolute right-4 bottom-24 md:bottom-8 flex flex-col gap-2 z-10">
      <Button
        variant="secondary"
        size="icon"
        className="h-10 w-10 rounded-full glass shadow-lg hover:scale-105 transition-transform"
        onClick={onZoomIn}
      >
        <span className="text-xl">+</span>
      </Button>
      <Button
        variant="secondary"
        size="icon"
        className="h-10 w-10 rounded-full glass shadow-lg hover:scale-105 transition-transform"
        onClick={onZoomOut}
      >
        <span className="text-xl">-</span>
      </Button>
      <Button
        variant="secondary"
        size="icon"
        className="h-10 w-10 rounded-full glass shadow-lg hover:scale-105 transition-transform mt-2"
        onClick={onCurrentLocation}
      >
        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </Button>
    </div>
  );
}
