import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { ArrayObject, Value } from '../trace/types';
import { groupMarkersByCell, type IndexMarker } from './indexMarkers';
import { ValueView } from './ValueView';
import type { ArrayChange } from './diff';

export interface ArrayViewProps {
  id: string;
  obj: ArrayObject;
  name?: string;
  markers?: IndexMarker[];
  changes?: ArrayChange[];
  isHovered?: boolean;
  isFocused?: boolean;
  onHoverRef?: (id: string | null) => void;
  onClickRef?: (id: string) => void;
  className?: string;
}

export const ArrayView: React.FC<ArrayViewProps> = ({
  id,
  obj,
  name,
  markers = [],
  changes = [],
  isHovered = false,
  isFocused = false,
  onHoverRef,
  onClickRef,
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();
  const markersByCell = groupMarkersByCell(markers);

  // Map of index -> previous value for changed cells
  const changeMap = new Map<number, Value>();
  for (const c of changes) {
    changeMap.set(c.index, c.prev);
  }

  return (
    <div
      id={`heap-${id.replace('@', '')}`}
      data-testid={`array-view-${id}`}
      className={`rounded-lg border bg-canvas-subtle p-3.5 shadow-sm transition-all ${
        isFocused
          ? 'border-blue-400 ring-2 ring-blue-500/40'
          : isHovered
            ? 'border-violet-400 ring-1 ring-violet-500/30'
            : 'border-white/10'
      } ${className}`}
    >
      {/* Header */}
      <div className="mb-2.5 flex items-center justify-between gap-2 border-b border-white/5 pb-1.5">
        <div className="flex items-center gap-2">
          {name && (
            <span className="font-mono text-xs font-semibold text-blue-300">
              {name}
            </span>
          )}
          <span className="font-mono text-[11px] text-gray-400">
            {obj.elemType}[{obj.length}]
          </span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
            {id}
          </span>
        </div>
        {obj.clipped && (
          <span className="rounded border border-amber-500/30 bg-amber-950/40 px-1.5 py-0.5 text-[10px] text-amber-300">
            Clipped: showing first {obj.items.length} of {obj.length}
          </span>
        )}
      </div>

      {/* Row of cells */}
      <div className="flex items-start overflow-x-auto pb-2 pt-1">
        {obj.items.map((item, index) => {
          const isChanged = changeMap.has(index);
          const prevVal = changeMap.get(index);
          const cellMarkers = markersByCell.get(index);

          const cellVariants = shouldReduceMotion
            ? {
                initial: {},
                animate: isChanged
                  ? {
                      backgroundColor: ['rgba(245, 158, 11, 0.25)', 'transparent'],
                    }
                  : {},
              }
            : {
                initial: { scale: 1 },
                animate: isChanged
                  ? {
                      scale: [1, 1.04, 1],
                      backgroundColor: ['rgba(245, 158, 11, 0.35)', 'transparent'],
                      transition: { duration: 0.7 },
                    }
                  : {},
              };

          return (
            <div
              key={index}
              data-testid={`array-cell-${index}`}
              className="flex shrink-0 flex-col items-center"
            >
              {/* Index label above cell */}
              <span className="mb-1 font-mono text-[10px] text-gray-500">
                {index}
              </span>

              {/* Cell Box */}
              <motion.div
                variants={cellVariants}
                initial="initial"
                animate="animate"
                className={`relative flex min-h-[44px] min-w-[52px] items-center justify-center border-y border-r border-white/15 bg-canvas-muted px-2 py-1.5 font-mono text-xs transition-colors ${
                  index === 0 ? 'rounded-l border-l' : ''
                } ${index === obj.items.length - 1 && !obj.clipped ? 'rounded-r' : ''} ${
                  isChanged ? 'bg-amber-950/30 ring-1 ring-inset ring-amber-400/50' : ''
                }`}
              >
                <ValueView
                  value={item}
                  type={obj.elemType}
                  isChanged={isChanged}
                  prevValue={prevVal}
                  onHoverRef={onHoverRef}
                  onClickRef={onClickRef}
                />
              </motion.div>

              {/* Index marker pointers below cell */}
              <div className="mt-1.5 flex flex-col items-center gap-0.5">
                {cellMarkers && cellMarkers.length > 0 && (
                  <>
                    <span className="text-[10px] leading-none text-blue-400">
                      ▲
                    </span>
                    <div className="flex flex-col items-center gap-0.5">
                      {cellMarkers.map((markerVar) => (
                        <span
                          key={markerVar}
                          className="rounded border border-blue-500/40 bg-blue-950/60 px-1 py-0.5 font-mono text-[10px] font-bold text-blue-300 shadow-sm"
                          title={`Local variable '${markerVar}' points to index ${index}`}
                        >
                          {markerVar}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* Clipped indicator */}
        {obj.clipped && (
          <div className="flex shrink-0 flex-col items-center pl-2">
            <span className="mb-1 font-mono text-[10px] text-gray-600">…</span>
            <div
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-r border border-dashed border-amber-500/40 bg-amber-950/20 px-2 font-mono text-xs text-amber-400"
              title={`${obj.length - obj.items.length} more elements clipped`}
            >
              …
            </div>
            <span className="mt-1 text-[9px] text-amber-500/80">
              +{obj.length - obj.items.length}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
