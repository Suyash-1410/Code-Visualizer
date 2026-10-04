import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { ArrayObject, StackFrame, Value } from '../../trace/types';
import { computeIndexMarkers, groupMarkersByCell } from '../indexMarkers';
import { ValueView } from '../ValueView';
import type { ArrayChange } from '../diff';
import {
  type HeapDiffResult,
  computeArrayTokenOffset,
} from './heapDiff';

export interface HeapArrayViewProps {
  id: string;
  obj: ArrayObject;
  name?: string;
  size: number;
  selectedFrame?: StackFrame;
  changes?: ArrayChange[];
  heapDiff?: HeapDiffResult;
  duration?: number;
  hoveredIndex?: number | null;
  focusedIndex?: number | null;
  hoveredFrame?: StackFrame;
  hoveredVariableName?: string | null;
  onHoverIndex?: (index: number | null) => void;
  onClickIndex?: (index: number) => void;
  onHoverRef?: (id: string | null) => void;
  onClickRef?: (id: string) => void;
  className?: string;
}

export const HeapArrayView: React.FC<HeapArrayViewProps> = ({
  id,
  obj,
  name,
  size,
  selectedFrame,
  changes = [],
  heapDiff,
  duration = 0.28,
  hoveredIndex = null,
  focusedIndex = null,
  hoveredFrame,
  hoveredVariableName = null,
  onHoverIndex,
  onClickIndex,
  onHoverRef,
  onClickRef,
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();

  // Compute index markers for any int locals whose value falls in [0, obj.length)
  const markers = selectedFrame
    ? computeIndexMarkers(selectedFrame, obj.length)
    : [];
  const markersByCell = groupMarkersByCell(markers);

  // Map of index -> previous value for changed cells
  const changeMap = new Map<number, Value>();
  for (const c of changes) {
    changeMap.set(c.index, c.prev);
  }

  const formatValue = (v: Value | undefined): string => {
    if (!v) return '-';
    if (v.k === 'prim') return String(v.v);
    if (v.k === 'str') return `"${v.v}"`;
    if (v.k === 'ref') return v.id;
    if (v.k === 'null') return 'null';
    return '?';
  };

  return (
    <div
      data-testid="heap-array-view"
      className={`rounded-lg border border-white/10 bg-canvas-subtle p-3 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/5 pb-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-blue-300">
            {name || 'array'}
          </span>
          <span className="font-mono text-[11px] text-gray-400">
            {obj.elemType}[{obj.length}]
          </span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
            {id}
          </span>
          <span className="rounded border border-indigo-500/30 bg-indigo-950/40 px-1.5 py-0.5 font-mono text-[10px] text-indigo-300">
            heap prefix [0..{Math.max(0, size - 1)}] ({size} of {obj.length} slots)
          </span>

          {/* Floating temp chip for intermediate inline swap states */}
          {heapDiff?.tempVariable && (
            <div
              data-testid="heap-temp-chip"
              className="flex items-center gap-1 rounded border border-amber-500/40 bg-amber-950/70 px-2 py-0.5 font-mono text-[10px] text-amber-200 shadow-sm animate-pulse"
              title="Local variable holding temporary swap value (intermediate state)"
            >
              <span className="font-bold text-amber-300">
                {heapDiff.tempVariable.name}
              </span>
              <span>=</span>
              <span className="font-bold text-white">
                {formatValue(heapDiff.tempVariable.value)}
              </span>
            </div>
          )}
        </div>

        {obj.clipped && (
          <span className="rounded border border-amber-500/30 bg-amber-950/40 px-1.5 py-0.5 text-[10px] text-amber-300">
            Clipped: showing first {obj.items.length} of {obj.length}
          </span>
        )}
      </div>

      {/* Row of cells */}
      <div className="flex items-start overflow-x-auto pb-2 pt-1">
        {(obj.items || []).map((item, index) => {
          const isInsideHeap = index < size;
          const cellMarkers = markersByCell.get(index);
          const isHovered =
            hoveredIndex === index ||
            Boolean(hoveredVariableName && cellMarkers?.includes(hoveredVariableName)) ||
            Boolean(hoveredFrame && hoveredFrame.locals.some((l) => l.value.k === 'prim' && l.value.v === index));
          const isFocused = focusedIndex === index;
          const isChanged = changeMap.has(index);
          const prevVal = changeMap.get(index);

          const prevIdx = heapDiff?.movedFromPrev.get(index);
          const isMoved = prevIdx !== undefined;
          const tokenOffset = isMoved
            ? computeArrayTokenOffset(index, prevIdx)
            : { dx: 0, dy: 0 };

          const isSwapped =
            heapDiff?.swap &&
            (heapDiff.swap.indexA === index || heapDiff.swap.indexB === index);
          const isEqualSwap = isSwapped && Boolean(heapDiff?.swap?.isEqual);

          const isSorted = heapDiff?.sortedIndices.has(index);

          const cellVariants = shouldReduceMotion
            ? {
                initial: {},
                animate: isEqualSwap
                  ? {
                      backgroundColor: [
                        'rgba(245, 158, 11, 0.4)',
                        'transparent',
                      ],
                    }
                  : isChanged
                    ? {
                        backgroundColor: [
                          'rgba(245, 158, 11, 0.25)',
                          'transparent',
                        ],
                      }
                    : {},
              }
            : {
                initial: { scale: 1 },
                animate: isEqualSwap
                  ? {
                      scale: [1, 1.05, 1],
                      backgroundColor: [
                        'rgba(245, 158, 11, 0.5)',
                        'transparent',
                      ],
                      transition: { duration: 0.6 },
                    }
                  : isChanged
                    ? {
                        scale: [1, 1.04, 1],
                        backgroundColor: [
                          'rgba(245, 158, 11, 0.35)',
                          'transparent',
                        ],
                        transition: { duration: 0.7 },
                      }
                    : {},
              };

          return (
            <div
              key={index}
              data-testid={`heap-cell-${index}`}
              className={`flex shrink-0 flex-col items-center transition-opacity ${
                !isInsideHeap ? 'opacity-40' : ''
              }`}
              onMouseEnter={() => onHoverIndex?.(index)}
              onMouseLeave={() => onHoverIndex?.(null)}
              onClick={() => onClickIndex?.(index)}
            >
              {/* Index label above cell */}
              <span
                className={`mb-1 font-mono text-[10px] ${
                  isHovered || (cellMarkers && cellMarkers.length > 0)
                    ? 'font-bold text-sky-400'
                    : isInsideHeap
                      ? 'text-gray-400'
                      : 'text-gray-600'
                }`}
                title={
                  !isInsideHeap
                    ? isSorted
                      ? `Index ${index} (sorted region)`
                      : `Index ${index} (outside heap)`
                    : `Index ${index}`
                }
              >
                {index}
              </span>

              {/* Cell Box */}
              <motion.div
                variants={cellVariants}
                initial="initial"
                animate="animate"
                className={`relative flex min-h-[44px] min-w-[52px] cursor-pointer items-center justify-center border-y border-r border-white/15 px-2 py-1.5 font-mono text-xs transition-all ${
                  index === 0 ? 'rounded-l border-l' : ''
                } ${index === obj.items.length - 1 && !obj.clipped ? 'rounded-r' : ''} ${
                  isFocused
                    ? 'border-blue-400 bg-blue-950/50 ring-2 ring-inset ring-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.5)]'
                    : isHovered
                      ? 'border-sky-400 bg-sky-950/40 ring-2 ring-inset ring-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)]'
                      : isSwapped
                        ? 'border-amber-400 bg-amber-950/40 ring-2 ring-inset ring-amber-400/70 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                        : isChanged
                          ? 'bg-amber-950/30 ring-1 ring-inset ring-amber-400/50'
                          : !isInsideHeap
                            ? 'border-dashed bg-zinc-900/60'
                            : cellMarkers && cellMarkers.length > 0
                              ? 'bg-blue-500/10 ring-1 ring-inset ring-blue-400/30'
                              : 'bg-canvas-muted'
                }`}
              >
                {/* Value Token: flying motion if moved from prevIndex */}
                <motion.div
                  initial={
                    isMoved && !shouldReduceMotion && duration > 0
                      ? { x: tokenOffset.dx, opacity: 0.8 }
                      : false
                  }
                  animate={{ x: 0, opacity: 1 }}
                  transition={
                    isMoved && !shouldReduceMotion && duration > 0
                      ? { duration, ease: 'easeInOut' }
                      : { duration: 0 }
                  }
                  data-testid={`value-token-${index}`}
                  className="flex items-center justify-center"
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
              </motion.div>

              {/* Index marker pointers below cell */}
              <div className="mt-1.5 flex flex-col items-center gap-0.5">
                {cellMarkers && cellMarkers.length > 0 && (
                  <>
                    <span
                      className={`text-[10px] leading-none ${
                        isHovered ? 'text-sky-300' : 'text-blue-400'
                      }`}
                    >
                      ▲
                    </span>
                    <div className="flex flex-col items-center gap-0.5">
                      {cellMarkers.map((markerVar) => (
                        <motion.button
                          layout
                          layoutId={`heap-array-marker-${markerVar}`}
                          transition={
                            !shouldReduceMotion && duration > 0
                              ? { duration, ease: 'easeInOut' }
                              : { duration: 0 }
                          }
                          type="button"
                          key={markerVar}
                          data-testid={`marker-chip-${markerVar}`}
                          className={`rounded border px-1 py-0.5 font-mono text-[10px] font-bold shadow-sm transition-colors ${
                            isHovered
                              ? 'border-sky-400 bg-sky-950 text-sky-200'
                              : 'border-blue-500/40 bg-blue-950/60 text-blue-300 hover:border-sky-400 hover:text-sky-200'
                          }`}
                          title={`Local variable '${markerVar}' points to index ${index}`}
                          onMouseEnter={(e) => {
                            e.stopPropagation();
                            onHoverIndex?.(index);
                          }}
                          onMouseLeave={(e) => {
                            e.stopPropagation();
                            onHoverIndex?.(null);
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onClickIndex?.(index);
                          }}
                        >
                          {markerVar}
                        </motion.button>
                      ))}
                    </div>
                  </>
                )}
                {!isInsideHeap && (!cellMarkers || cellMarkers.length === 0) && (
                  <>
                    {isSorted ? (
                      <span
                        data-testid={`sorted-badge-${index}`}
                        className="rounded border border-emerald-500/40 bg-emerald-950/70 px-1 py-0.2 text-[9px] font-bold text-emerald-400"
                        title={`Index ${index} is in sorted region`}
                      >
                        sorted
                      </span>
                    ) : (
                      <span className="text-[9px] text-gray-600">outside</span>
                    )}
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
