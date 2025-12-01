// src/components/GlassPanel.jsx
import React from 'react';

const GlassPanel = ({ children, className = '' }) => {
  return (
    <div
      className={`
        rounded-3xl
        bg-white/12
        border border-white/30
        backdrop-blur-xl
        shadow-[0_18px_45px_rgba(0,0,0,0.45)]
        ${className}
      `}
    >
      {children}
    </div>
  );
};

export default GlassPanel;
