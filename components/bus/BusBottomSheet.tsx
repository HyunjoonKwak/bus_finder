'use client';

import { Drawer } from 'vaul';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface BusBottomSheetProps {
  children: React.ReactNode;
  snapPoints?: string[] | number[];
}

export function BusBottomSheet({ children, snapPoints = ['180px', '45%', '95%'] }: BusBottomSheetProps) {
  const [snap, setSnap] = useState<number | string | null>(snapPoints[1]);

  return (
    <div className="md:hidden">
      <Drawer.Root
        snapPoints={snapPoints}
        activeSnapPoint={snap}
        setActiveSnapPoint={setSnap}
        modal={false}
        open={true}
      >
        <Drawer.Content className="fixed flex flex-col bg-background/95 backdrop-blur-xl border-t border-white/20 bottom-0 left-0 right-0 h-full max-h-[96%] mx-[-1px] rounded-t-[10px] shadow-2xl z-20 outline-none">
          {/* Handle */}
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted-foreground/20 mt-3 mb-2" />
          
          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pt-0">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Root>
    </div>
  );
}
