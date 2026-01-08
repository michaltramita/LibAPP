import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

const ScenarioPicker = ({
  id,
  label,
  value,
  onChange,
  scenarios,
  placeholder,
}) => {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxRef = useRef(null);
  const optionRefs = useRef([]);

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => scenario.id === value),
    [scenarios, value]
  );

  useEffect(() => {
    if (!open) return;
    const selectedIndex = scenarios.findIndex((scenario) => scenario.id === value);
    const nextIndex = selectedIndex >= 0 ? selectedIndex : 0;
    setActiveIndex(nextIndex);
    requestAnimationFrame(() => {
      listboxRef.current?.focus();
      optionRefs.current[nextIndex]?.scrollIntoView({ block: 'nearest' });
    });
  }, [open, scenarios, value]);

  useEffect(() => {
    if (activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  const handleSelect = (scenarioId) => {
    if (scenarioId !== value) {
      onChange(scenarioId);
    }
    setOpen(false);
  };

  const handleTriggerKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen((prev) => !prev);
    }
  };

  const handleListKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, scenarios.length - 1));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const scenario = scenarios[activeIndex];
      if (scenario) {
        handleSelect(scenario.id);
      }
    }
  };

  const activeOptionId =
    activeIndex >= 0 && scenarios[activeIndex]
      ? `${id}-option-${scenarios[activeIndex].id}`
      : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={label}
          aria-labelledby={`${id}-label`}
          onKeyDown={handleTriggerKeyDown}
          className="flex w-full min-h-[64px] items-center justify-between gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-left text-base leading-normal text-slate-900 shadow-sm transition-colors hover:border-red-200 focus-visible:border-[#B81547] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B81547]/20"
        >
          <span className="flex flex-1 flex-col gap-1">
            <span
              className={cn(
                'truncate font-semibold',
                value ? 'text-slate-900' : 'text-slate-500'
              )}
            >
              {value ? selectedScenario?.title : placeholder}
            </span>
            <span className="text-sm text-slate-500">
              {value ? 'Kliknite pre zmenu' : 'Vyberte vhodný scenár'}
            </span>
          </span>
          <ChevronsUpDown className="h-5 w-5 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl"
      >
        <div
          ref={listboxRef}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={activeOptionId}
          onKeyDown={handleListKeyDown}
          className="max-h-[320px] space-y-2 overflow-y-auto pr-1 outline-none"
        >
          {scenarios.map((scenario, index) => {
            const isSelected = scenario.id === value;
            const isActive = index === activeIndex;
            return (
              <button
                key={scenario.id}
                id={`${id}-option-${scenario.id}`}
                type="button"
                role="option"
                aria-selected={isSelected}
                tabIndex={-1}
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                onClick={() => handleSelect(scenario.id)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  'flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors',
                  isSelected
                    ? 'border-[#B81547] bg-red-50'
                    : 'border-transparent bg-slate-50 hover:border-red-200 hover:bg-white',
                  isActive && !isSelected && 'border-red-200 bg-white'
                )}
              >
                <Check
                  className={cn(
                    'mt-1 h-4 w-4 shrink-0 text-[#B81547]',
                    isSelected ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <span className="flex flex-col gap-1">
                  <span className="font-semibold text-slate-900">{scenario.title}</span>
                  <span className="text-sm text-slate-600 line-clamp-2">
                    {scenario.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ScenarioPicker;
