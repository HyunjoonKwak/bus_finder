'use client';

import { useState, useEffect } from 'react';

interface CircularCountdownProps {
  duration?: number;
  current?: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  onComplete?: () => void;
}

export function CircularCountdown({ 
  duration = 10, 
  current, 
  size = 20, 
  strokeWidth = 2,
  color = 'text-green-500',
  onComplete
}: CircularCountdownProps) {
  const [internalProgress, setInternalProgress] = useState(100);
  const [startTime, setStartTime] = useState(Date.now());
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (current !== undefined) return;

    setStartTime(Date.now());
    const interval = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      if (elapsed >= duration) {
        onComplete?.();
        setStartTime(Date.now());
      }
      
      const cycleElapsed = elapsed % duration;
      const remaining = Math.max(0, 100 - (cycleElapsed / duration) * 100);
      setInternalProgress(remaining);
    }, 50);

    return () => clearInterval(interval);
  }, [duration, current, onComplete, startTime]);

  const progressPercentage = current !== undefined 
    ? (current / duration) * 100 
    : internalProgress;

  const strokeDashoffset = circumference - (progressPercentage / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-muted-foreground/20"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        className={`${color} transition-all duration-100`}
      />
    </svg>
  );
}
