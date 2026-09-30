import React from 'react';
import type { InstanceObject, Value } from '../trace/types';
import { ValueView } from './ValueView';
import type { FieldChange } from './diff';

export interface ObjectViewProps {
  id: string;
  obj: InstanceObject;
  name?: string;
  changes?: FieldChange[];
  isHovered?: boolean;
  isFocused?: boolean;
  onHoverRef?: (id: string | null) => void;
  onClickRef?: (id: string) => void;
  className?: string;
}

export const ObjectView: React.FC<ObjectViewProps> = ({
  id,
  obj,
  name,
  changes = [],
  isHovered = false,
  isFocused = false,
  onHoverRef,
  onClickRef,
  className = '',
}) => {
  const changeMap = new Map<string, Value>();
  for (const c of changes) {
    changeMap.set(c.field, c.prev);
  }

  const fieldEntries = Object.entries(obj.fields);

  return (
    <div
      id={`heap-${id.replace('@', '')}`}
      data-testid={`object-view-${id}`}
      className={`min-w-[220px] rounded-lg border bg-canvas-subtle p-3.5 shadow-sm transition-all ${
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
          <span className="font-mono text-xs font-semibold text-gray-200">
            {obj.type}
          </span>
        </div>
        <span className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
          {id}
        </span>
      </div>

      {/* Fields */}
      {fieldEntries.length === 0 ? (
        <div className="py-1 text-center font-mono text-xs italic text-gray-500">
          (no instance fields)
        </div>
      ) : (
        <div className="space-y-1.5">
          {fieldEntries.map(([field, val]) => {
            const isChanged = changeMap.has(field);
            const prevVal = changeMap.get(field);

            return (
              <div
                key={field}
                className={`flex items-center justify-between gap-3 rounded px-2 py-1 text-xs transition-colors ${
                  isChanged ? 'bg-amber-950/20' : 'hover:bg-white/4'
                }`}
              >
                <span className="font-mono text-gray-400">{field}:</span>
                <ValueView
                  value={val}
                  isChanged={isChanged}
                  prevValue={prevVal}
                  onHoverRef={onHoverRef}
                  onClickRef={onClickRef}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
