'use client';

import { cn } from '@/lib/utils';
import { useState } from 'react';

interface BusSidebarProps {
  children: React.ReactNode;
}

export function BusSidebar({ children }: BusSidebarProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <>
      <div
        className={cn(
          "hidden md:flex flex-col h-full bg-background border-r border-border transition-all duration-300 relative z-10 shadow-xl",
          isOpen ? "w-96" : "w-0"
        )}
      >
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
          <div className={cn("transition-opacity duration-200", isOpen ? "opacity-100" : "opacity-0")}>
            {children}
          </div>
        </div>
      </div>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "hidden md:flex absolute top-1/2 -translate-y-1/2 z-20 items-center justify-center w-6 h-12 bg-background border border-border rounded-r-lg shadow-md hover:bg-accent transition-all duration-300",
          isOpen ? "left-96" : "left-0"
        )}
        aria-label={isOpen ? "패널 닫기" : "패널 열기"}
      >
        <svg
          className={cn("w-4 h-4 text-muted-foreground transition-transform duration-300", isOpen ? "rotate-180" : "rotate-0")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </>
  );
}
