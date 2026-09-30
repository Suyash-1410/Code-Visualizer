import React, { useEffect, useRef } from 'react';
import type { StackFrame, Step, StaticField } from '../trace/types';
import type { StepDiff, ArrayChange } from './diff';
import { classify, collectReachable } from '../recognition/classify';
import { computeIndexMarkers } from './indexMarkers';
import { ArrayView } from './ArrayView';
import { GridView } from './GridView';
import { ObjectView } from './ObjectView';

export interface DiagramAreaProps {
  step?: Step;
  selectedFrame?: StackFrame;
  statics?: StaticField[];
  diff?: StepDiff;
  hoveredHeapId?: string | null;
  focusedHeapId?: string | null;
  onHoverHeap?: (id: string | null) => void;
  onFocusHeap?: (id: string | null) => void;
}

export const DiagramArea: React.FC<DiagramAreaProps> = ({
  step,
  selectedFrame,
  statics = [],
  diff,
  hoveredHeapId = null,
  focusedHeapId = null,
  onHoverHeap,
  onFocusHeap,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll when focusedHeapId changes
  useEffect(() => {
    if (!focusedHeapId) return;
    const targetElement = document.getElementById(
      `heap-${focusedHeapId.replace('@', '')}`,
    );
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [focusedHeapId]);

  if (!step || !step.heap || Object.keys(step.heap).length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-gray-500">
        <span>No heap objects allocated at this step.</span>
      </div>
    );
  }

  // Find root reference IDs from selected frame locals + static fields
  const rootIds: string[] = [];
  const varNamesByHeapId = new Map<string, string>();

  if (selectedFrame) {
    for (const local of selectedFrame.locals) {
      if (local.value.k === 'ref') {
        rootIds.push(local.value.id);
        if (!varNamesByHeapId.has(local.value.id)) {
          varNamesByHeapId.set(local.value.id, local.name);
        }
      }
    }
  }

  for (const s of statics) {
    if (s.value.k === 'ref') {
      rootIds.push(s.value.id);
      if (!varNamesByHeapId.has(s.value.id)) {
        varNamesByHeapId.set(s.value.id, `${s.class}.${s.name}`);
      }
    }
  }

  // Reachable heap IDs
  const reachable = collectReachable(rootIds, step.heap);

  // Set of inner array IDs already rendered inside a GridView to avoid duplicate cards
  const gridInnerArrayIds = new Set<string>();

  // First pass: identify 2D grids and register their inner array IDs
  for (const id of reachable) {
    const classification = classify(id, step.heap);
    if (classification.kind === 'grid') {
      for (const item of classification.obj.items) {
        if (item.k === 'ref') {
          gridInnerArrayIds.add(item.id);
        }
      }
    }
  }

  // Filter reachable objects to those that should be rendered as standalone cards
  const standaloneIds = Array.from(reachable).filter((id) => {
    if (gridInnerArrayIds.has(id)) return false;
    // Omit default empty String[0] args array from JVM
    const name = varNamesByHeapId.get(id);
    const obj = step.heap[id];
    if (name === 'args' && obj && obj.kind === 'array' && obj.length === 0) {
      return false;
    }
    return true;
  });

  if (standaloneIds.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-gray-500">
        <span>No heap objects referenced by active variables.</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex h-full flex-wrap content-start items-start gap-4 overflow-auto p-4"
    >
      {standaloneIds.map((id) => {
        const classification = classify(id, step.heap);
        const name = varNamesByHeapId.get(id);
        const isHovered = hoveredHeapId === id;
        const isFocused = focusedHeapId === id;
        const heapChange = diff?.changedHeap.get(id);

        switch (classification.kind) {
          case 'grid': {
            // Collect inner array changes
            const innerChanges = new Map<string, ArrayChange[]>();
            for (const item of classification.obj.items) {
              if (item.k === 'ref') {
                const ch = diff?.changedHeap.get(item.id);
                if (ch && ch.arrayChanges) {
                  innerChanges.set(item.id, ch.arrayChanges);
                }
              }
            }

            return (
              <GridView
                key={id}
                id={id}
                obj={classification.obj}
                innerArrays={classification.innerArrays}
                name={name}
                innerChanges={innerChanges}
                isHovered={isHovered}
                isFocused={isFocused}
                onHoverRef={onHoverHeap}
                onClickRef={onFocusHeap}
              />
            );
          }

          case 'array': {
            const markers = selectedFrame
              ? computeIndexMarkers(selectedFrame, classification.obj.length)
              : [];

            return (
              <ArrayView
                key={id}
                id={id}
                obj={classification.obj}
                name={name}
                markers={markers}
                changes={heapChange?.arrayChanges ?? []}
                isHovered={isHovered}
                isFocused={isFocused}
                onHoverRef={onHoverHeap}
                onClickRef={onFocusHeap}
              />
            );
          }

          case 'object': {
            return (
              <ObjectView
                key={id}
                id={id}
                obj={classification.obj}
                name={name}
                changes={heapChange?.fieldChanges ?? []}
                isHovered={isHovered}
                isFocused={isFocused}
                onHoverRef={onHoverHeap}
                onClickRef={onFocusHeap}
              />
            );
          }

          case 'opaque': {
            return (
              <div
                key={id}
                className="rounded-lg border border-white/10 bg-canvas-subtle p-3.5 shadow-sm"
              >
                <div className="font-mono text-xs text-gray-400">{id}</div>
                <div className="mt-1 text-xs text-gray-500">
                  Not yet visualized
                </div>
              </div>
            );
          }
        }
      })}
    </div>
  );
};
