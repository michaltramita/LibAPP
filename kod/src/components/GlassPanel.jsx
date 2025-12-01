import React from 'react';
import clsx from 'clsx';

const GlassPanel = ({ className, children }) => {
  return (
    <div
      className={clsx(
        'rounded-3xl border border-white/15 bg-white/10',
        'backdrop-blur-xl shadow-2xl shadow-black/40',
        'bg-gradient-to-br from-white/15 via-white/5 to-white/0',
        className
      )}
    >
      {children}
    </div>
  );
};

export default GlassPanel;
