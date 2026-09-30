import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { ArrayObject, Value } from '../trace/types';
import { ValueView } from './ValueView';
import type { ArrayChange } from './diff';

export interface GridViewProps {
  id: string;
  obj: ArrayObject;
  innerArrays: ArrayObject[];
  name?: string;
  innerChanges?: Map<string, ArrayChange[]>; // map of inner array id -> changes
  isHovered?: boolean;
  isFocused?: boolean;
  onHoverRef?: (id: string | null) => void;
  onClickRef?: (id: string) => void;
  className?: string;
}

export const GridView: React.FC<GridViewProps> = ({
  id,
  obj,
  innerArrays,
  name,
  innerChanges = new Map(),
  isHovered = false,
  isFocused = false,
  onHoverRef,
  onClickRef,
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();

  // Determine maximum column count from inner arrays
  const maxCols = Math.max(0, ...innerArrays.map((arr) => arr?.items?.length ?? 0));
  const elemType = innerArrays[0]?.elemType ?? 'int';

  return (
    <div
      id={`heap-${id.replace('@', '')}`}
      data-testid={`grid-view-${id}`}
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
            {elemType}[{obj.length}][{maxCols}]
          </span>
          <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
            {id}
          </span>
        </div>
        <span className="rounded bg-violet-950/40 px-1.5 py-0.5 text-[10px] font-medium text-violet-300">
          2D Grid
        </span>
      </div>

      {/* Grid table */}
      <div className="overflow-x-auto pb-1">
        <table className="border-collapse font-mono text-xs">
          <thead>
            <tr>
              {/* Top-left corner empty cell */}
              <th className="p-1 text-center font-mono text-[10px] text-gray-600">
                r\c
              </th>
              {/* Column index headers */}
              {Array.from({ length: maxCols }).map((_, c) => (
                <th
                  key={c}
                  className="p-1 text-center font-mono text-[10px] font-normal text-gray-500"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {innerArrays.map((rowArr, r) => {
              // Find the ref id of this row array if present
              const rowRefVal = obj.items[r];
              const rowId = rowRefVal && rowRefVal.k === 'ref' ? rowRefVal.id : undefined;
              const rowChanges = rowId ? innerChanges.get(rowId) ?? [] : [];

              const changeMap = new Map<number, Value>();
              for (const ch of rowChanges) {
                changeMap.set(ch.index, ch.prev);
              }

              return (
                <tr key={r}>
                  {/* Row index header */}
                  <th className="pr-2 text-right font-mono text-[10px] font-normal text-gray-500">
                    {r}
                  </th>

                  {/* Cells */}
                  {Array.from({ length: maxCols }).map((_, c) => {
                    const item = rowArr?.items[c];
                    if (!item) {
                      return (
                        <td
                          key={c}
                          className="border border-white/5 bg-canvas-muted/40 p-1 text-center text-gray-600"
                        >
                          -
                        </td>
                      );
                    }

                    const isChanged = changeMap.has(c);
                    const prevVal = changeMap.get(c);

                    const cellVariants = shouldReduceMotion
                      ? {
                          initial: {},
                          animate: isChanged
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
                          animate: isChanged
                            ? {
                                scale: [1, 1.05, 1],
                                backgroundColor: [
                                  'rgba(245, 158, 11, 0.35)',
                                  'transparent',
                                ],
                                transition: { duration: 0.7 },
                              }
                            : {},
                        };

                    return (
                      <td
                        key={c}
                        data-testid={`grid-cell-${r}-${c}`}
                        className="p-0.5"
                      >
                        <motion.div
                          variants={cellVariants}
                          initial="initial"
                          animate="animate"
                          className={`flex min-h-[38px] min-w-[46px] items-center justify-center rounded border border-white/10 bg-canvas-muted px-2 py-1 ${
                            isChanged
                              ? 'bg-amber-950/30 ring-1 ring-inset ring-amber-400/50'
                              : ''
                          }`}
                        >
                          <ValueView
                            value={item}
                            type={elemType}
                            isChanged={isChanged}
                            prevValue={prevVal}
                            onHoverRef={onHoverRef}
                            onClickRef={onClickRef}
                          />
                        </motion.div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
