import React, { useId, useMemo } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const getPreviewText = (text) => {
  if (!text) return '';
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 120) return normalized;
  return `${normalized.slice(0, 117).trimEnd()}…`;
};

const ScenarioPicker = ({
  scenarios,
  value,
  onChange,
  label,
  helperText,
  icon: LabelIcon,
}) => {
  const labelId = useId();
  const helperId = useId();

  const previews = useMemo(
    () =>
      scenarios.reduce((acc, scenario) => {
        acc[scenario.id] = getPreviewText(scenario.description);
        return acc;
      }, {}),
    [scenarios]
  );

  const handleArrowSelection = (direction) => {
    if (!scenarios.length) return;
    const currentIndex = Math.max(
      0,
      scenarios.findIndex((scenario) => scenario.id === value)
    );
    const nextIndex =
      direction === 'prev'
        ? (currentIndex - 1 + scenarios.length) % scenarios.length
        : (currentIndex + 1) % scenarios.length;
    onChange(scenarios[nextIndex].id);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      handleArrowSelection('prev');
    }
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      handleArrowSelection('next');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 text-lg font-semibold text-white">
        {LabelIcon ? (
          <LabelIcon className="w-5 h-5 text-white opacity-80" />
        ) : null}
        <span id={labelId}>{label}</span>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        aria-describedby={helperText ? helperId : undefined}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className="grid w-full grid-cols-1 gap-4 md:grid-cols-2"
      >
        {scenarios.map((scenario) => {
          const isSelected = scenario.id === value;
          return (
            <div
              key={scenario.id}
              role="radio"
              aria-checked={isSelected}
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault();
                  onChange(scenario.id);
                }
                if (
                  event.key === 'ArrowLeft' ||
                  event.key === 'ArrowRight' ||
                  event.key === 'ArrowUp' ||
                  event.key === 'ArrowDown'
                ) {
                  handleKeyDown(event);
                }
              }}
              onClick={() => onChange(scenario.id)}
              className={cn(
                'relative flex h-full cursor-pointer flex-col rounded-2xl border-2 px-4 py-4 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80',
                isSelected
                  ? 'border-[#B81547] bg-white text-slate-900 shadow-lg'
                  : 'border-white/50 bg-white/10 text-white hover:bg-white/20'
              )}
            >
              {isSelected ? (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-[#B81547] px-2 py-1 text-xs font-semibold text-white">
                  <Check className="h-3 w-3" />
                  Vybrané
                </span>
              ) : null}
              <p className="text-base font-semibold">{scenario.title}</p>
              <p
                className={cn(
                  'mt-2 text-sm',
                  isSelected ? 'text-slate-600' : 'text-white/80'
                )}
              >
                {previews[scenario.id]}
              </p>
            </div>
          );
        })}
      </div>
      {helperText ? (
        <p id={helperId} className="text-sm text-white/90">
          {helperText}
        </p>
      ) : null}
    </div>
  );
};

export default ScenarioPicker;
