import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Svetlý „liquid glass“ panel vhodný na bielom pozadí.
 * Používa polopriesvitnú bielu, jemný border a blur.
 */
const GlassPanel = ({ className, children }) => {
  return (
    <div
      className={cn(
        'rounded-3xl border border-slate-200/80',
        'bg-white/70 backdrop-blur-lg',
        'shadow-[0_18px_45px_rgba(15,23,42,0.12)]',
        'transition-colors duration-200',
        className
      )}
    >
      {children}
    </div>
  );
};

export default GlassPanel;
