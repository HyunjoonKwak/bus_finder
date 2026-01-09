'use client';

import { useSearchStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function FilterOptions() {
  const { filters, setFilters } = useSearchStore();

  const filterItems = [
    { key: 'minimizeWalk' as const, label: '최소 도보', icon: '🚶' },
    { key: 'minimizeTransfer' as const, label: '최소 환승', icon: '🔄' },
    { key: 'hasLuggage' as const, label: '짐 있음', icon: '🧳' },
    { key: 'isRainy' as const, label: '비 오는 날', icon: '🌧️' },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filterItems.map((item) => (
        <Badge
          key={item.key}
          variant="outline"
          className={cn(
            'cursor-pointer px-3 py-1.5 text-sm transition-all duration-200',
            filters[item.key]
              ? 'border-primary bg-primary/10 text-primary shadow-sm'
              : 'border-border text-muted-foreground hover:border-primary/50 hover:bg-accent hover:text-accent-foreground'
          )}
          onClick={() => setFilters({ [item.key]: !filters[item.key] })}
        >
          <span className="mr-1">{item.icon}</span>
          {item.label}
        </Badge>
      ))}
    </div>
  );
}
