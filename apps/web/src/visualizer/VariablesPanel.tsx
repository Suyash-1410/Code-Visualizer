import React from 'react';
import type { StackFrame, StaticField, Value } from '../trace/types';
import type { StepDiff } from './diff';
import { ValueView } from './ValueView';

export interface VariablesPanelProps {
  frame?: StackFrame;
  statics?: StaticField[];
  diff?: StepDiff;
  onHoverHeap?: (id: string | null) => void;
  onFocusHeap?: (id: string) => void;
}

export const VariablesPanel: React.FC<VariablesPanelProps> = ({
  frame,
  statics = [],
  diff,
  onHoverHeap,
  onFocusHeap,
}) => {
  // Map of changed variable names -> previous Value
  const changedMap = new Map<string, Value | undefined>();
  if (frame && diff) {
    const changes = diff.changedLocals.get(frame.frameId) ?? [];
    for (const c of changes) {
      changedMap.set(c.name, c.prev);
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/8 px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Variables
        </span>
        {frame && (
          <span className="truncate font-mono text-[10px] text-gray-400">
            {frame.method}():{frame.line}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Local Variables */}
        {frame ? (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/8 text-left text-[10px] text-gray-500">
                <th className="px-3 py-1 font-medium">Name</th>
                <th className="px-3 py-1 font-medium">Type</th>
                <th className="px-3 py-1 font-medium">Value</th>
              </tr>
            </thead>
            <tbody>
              {frame.locals.map((local) => {
                const isChanged = changedMap.has(local.name);
                const prevVal = changedMap.get(local.name);

                return (
                  <tr
                    key={local.name}
                    className={`border-b border-white/4 transition-colors ${
                      isChanged ? 'bg-amber-950/20' : 'hover:bg-white/4'
                    }`}
                  >
                    <td className="px-3 py-1.5 font-mono font-medium text-blue-300">
                      {local.name}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[11px] text-gray-400">
                      {local.type}
                    </td>
                    <td className="px-3 py-1.5">
                      <ValueView
                        value={local.value}
                        type={local.type}
                        isChanged={isChanged}
                        prevValue={prevVal}
                        onHoverRef={onHoverHeap}
                        onClickRef={onFocusHeap}
                      />
                    </td>
                  </tr>
                );
              })}
              {frame.locals.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-4 text-center italic text-gray-500"
                  >
                    No local variables in this frame.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="flex h-32 items-center justify-center text-xs text-gray-500">
            No active stack frame.
          </div>
        )}

        {/* Static Fields Section */}
        {statics.length > 0 && (
          <div className="mt-3 border-t border-white/8">
            <div className="bg-canvas-subtle/50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Static Fields
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/8 text-left text-[10px] text-gray-500">
                  <th className="px-3 py-1 font-medium">Field</th>
                  <th className="px-3 py-1 font-medium">Type</th>
                  <th className="px-3 py-1 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {statics.map((s, idx) => (
                  <tr
                    key={`${s.class}.${s.name}-${idx}`}
                    className="border-b border-white/4 hover:bg-white/4"
                  >
                    <td className="px-3 py-1.5 font-mono text-purple-300">
                      <span className="text-gray-500">{s.class}.</span>
                      {s.name}
                    </td>
                    <td className="px-3 py-1.5 font-mono text-[11px] text-gray-400">
                      {s.type}
                    </td>
                    <td className="px-3 py-1.5">
                      <ValueView
                        value={s.value}
                        type={s.type}
                        onHoverRef={onHoverHeap}
                        onClickRef={onFocusHeap}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
