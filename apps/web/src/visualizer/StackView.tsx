import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { StackStructure, StructureOverride } from '../recognition/types';
import type { ArrayObject, HeapObject, StackFrame, Value } from '../trace/types';
import type { StepDiff } from './diff';
import {
  computeStackDiff,
  getAnimationDuration,
  type StackDiffResult,
} from './stackQueueDiff';
import { StructureHeader } from './StructureHeader';
import { ValueView } from './ValueView';
import { ArrayView } from './ArrayView';
import { computeIndexMarkers } from './indexMarkers';
import { useAppStore } from '../store';

export interface StackViewProps {
  structure: StackStructure;
  prevStructure?: StackStructure;
  heap: Record<string, HeapObject>;
  prevHeap?: Record<string, HeapObject>;
  selectedFrame?: StackFrame;
  diff?: StepDiff;
  diffResult?: StackDiffResult;
  isBackward?: boolean;
  hoveredHeapId?: string | null;
  focusedHeapId?: string | null;
  hoveredFrame?: StackFrame;
  hoveredVariableName?: string | null;
  hoveredFrameNodeIds?: Set<string>;
  onHoverRef?: (id: string | null) => void;
  onClickRef?: (id: string) => void;
  onViewOverride?: (id: string, kind: StructureOverride) => void;
  className?: string;
}

export const StackView: React.FC<StackViewProps> = ({
  structure,
  prevStructure,
  heap,
  prevHeap,
  selectedFrame,
  diff,
  diffResult,
  isBackward = false,
  hoveredHeapId = null,
  focusedHeapId = null,
  hoveredFrame,
  hoveredVariableName = null,
  hoveredFrameNodeIds,
  onHoverRef,
  onClickRef,
  onViewOverride,
  className = '',
}) => {
  const [showRawArray, setShowRawArray] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  const speed = useAppStore((s) => s.playback?.speed ?? 1);
  const isPlaying = useAppStore((s) => s.playback?.isPlaying ?? false);
  const duration = getAnimationDuration(speed, isPlaying, Boolean(shouldReduceMotion));

  // Compute structure-level diff
  const stackDiff =
    diffResult ??
    (prevStructure
      ? computeStackDiff(prevStructure, structure, prevHeap, heap, {
          isBackward,
        })
      : undefined);

  const isFocused =
    focusedHeapId === structure.id ||
    (structure.arrayId ? focusedHeapId === structure.arrayId : false);
  const isHovered =
    hoveredHeapId === structure.id ||
    (structure.arrayId ? hoveredHeapId === structure.arrayId : false);

  const containerMotion = shouldReduceMotion
    ? {}
    : {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.2 },
      };

  // -------------------------------------------------------------------------
  // 1. Array-backed Stack Rendering
  // -------------------------------------------------------------------------
  if (structure.backing === 'array' && structure.arrayId) {
    const arrayObj = heap[structure.arrayId] as ArrayObject | undefined;
    const arrayLength = structure.arrayLength ?? arrayObj?.length ?? 0;
    const topIndex = structure.topIndex ?? -1;

    // Changes for array cells from diff
    const arrayChanges = diff?.changedHeap.get(structure.arrayId)?.arrayChanges ?? [];
    const changeMap = new Map<number, Value>();
    for (const c of arrayChanges) {
      changeMap.set(c.index, c.prev);
    }

    // Capacity clipping: PRD requires clipping for >30 slots with a clear note
    const MAX_DISPLAY_SLOTS = 30;
    const isClipped = arrayLength > MAX_DISPLAY_SLOTS;
    const displaySlotCount = isClipped ? MAX_DISPLAY_SLOTS : arrayLength;

    // Build array of slot indices from top to bottom (displaySlotCount - 1 down to 0)
    // so that slot 0 is rendered at the bottom!
    const slotIndices: number[] = [];
    for (let i = displaySlotCount - 1; i >= 0; i--) {
      slotIndices.push(i);
    }

    // Index markers from stack frame
    const markers = selectedFrame
      ? computeIndexMarkers(selectedFrame, arrayLength)
      : [];
    const markersByCell = new Map<number, string[]>();
    for (const m of markers) {
      const arr = markersByCell.get(m.cellIndex) ?? [];
      arr.push(m.variableName);
      markersByCell.set(m.cellIndex, arr);
    }

    return (
      <motion.div
        {...containerMotion}
        id={`heap-${structure.id.replace(/[@:]/g, '_')}`}
        data-testid={`stack-view-${structure.id.replace(/[@:]/g, '_')}`}
        className={`flex flex-col rounded-xl border bg-canvas-subtle p-4 shadow-sm transition-all ${
          isFocused
            ? 'border-indigo-400 ring-2 ring-indigo-500/40'
            : isHovered
              ? 'border-indigo-500/40 ring-1 ring-indigo-500/20'
              : 'border-white/10'
        } ${className}`}
      >
        {/* Structure Header */}
        <StructureHeader
          id={structure.id}
          kind="stack"
          backing="array"
          confidence={structure.confidence}
          reasons={structure.reasons}
          className_={structure.className}
          variableName={structure.name}
          objectId={structure.wrapper?.id || structure.arrayId}
          nonStructuralFields={structure.wrapper?.nonNodeFields}
          badges={{
            isEmpty: structure.isEmpty,
            isFull: structure.isFull,
            isResized: stackDiff?.isResized || structure.isResized,
            resizeInfo: stackDiff?.resizeInfo,
          }}
          changedFields={stackDiff?.changedMarkers}
          showRawArrayToggle={true}
          showRawArray={showRawArray}
          onToggleRawArray={() => setShowRawArray((prev) => !prev)}
          onViewOverride={onViewOverride}
        />

        <div className="flex flex-wrap items-start gap-6">
          {/* Vertical Stack Column */}
          <div className="flex flex-col items-center">
            {/* Top clipping notice */}
            {isClipped && (
              <div
                data-testid="stack-clipped-notice"
                className="mb-2 rounded border border-amber-500/30 bg-amber-950/30 px-2 py-0.5 text-center text-[10px] text-amber-300"
              >
                Clipped: showing first {MAX_DISPLAY_SLOTS} of {arrayLength} slots
              </div>
            )}

            {/* Empty stack top marker indicator if top < 0 */}
            {topIndex < 0 && (
              <div
                data-testid="stack-empty-marker"
                className="mb-2 flex items-center gap-1.5 rounded bg-gray-800/80 px-2 py-0.5 font-mono text-[11px] text-gray-400"
              >
                <span className="font-bold text-indigo-400">top</span>
                <span> = -1</span>
                <span className="italic text-gray-500">(empty stack)</span>
              </div>
            )}

            {/* Slots stacked vertically (top index at top, 0 at bottom) */}
            <div
              data-testid="stack-slots-container"
              className="flex w-56 flex-col gap-1 rounded-t-md border-x-2 border-t-2 border-white/10 bg-canvas-muted/40 p-2"
            >
              {slotIndices.map((idx) => {
                const isOccupied = idx <= topIndex;
                const isTop = idx === topIndex;
                const val = arrayObj?.items[idx];
                const isCellMutated = changeMap.has(idx);
                const isSlotChanged =
                  isCellMutated ||
                  (stackDiff?.changedSlots.has(idx) ?? false) ||
                  stackDiff?.writtenSlot === idx;
                const prevVal = changeMap.get(idx);
                const otherMarkers = markersByCell.get(idx) || [];

                // Honest Diffs: Stale slot detection (popped elements left in the array)
                const isStale = stackDiff?.staleSlots.has(idx) ?? false;

                // Push / Pop animations
                const isJustPushed =
                  stackDiff?.op === 'push' && stackDiff?.pushedSlot === idx;
                const isJustPopped =
                  stackDiff?.op === 'pop' && stackDiff?.poppedSlot === idx;
                const isTopMarkerChanged = isTop && stackDiff?.changedMarkers.has('top');

                // Call-stack & Variable Hover Highlight (Stage 7)
                const isHoveredSlot =
                  Boolean(hoveredVariableName && markersByCell.get(idx)?.includes(hoveredVariableName)) ||
                  Boolean(hoveredFrame && hoveredFrame.locals.some((l) => l.value.k === 'prim' && l.value.v === idx));

                return (
                  <div
                    key={idx}
                    data-testid={`stack-slot-${idx}`}
                    className="relative flex items-center gap-2"
                  >
                    {/* Slot Index Label */}
                    <span
                      className={`w-6 text-right font-mono text-[10px] ${
                        isTop || isHoveredSlot ? 'font-bold text-indigo-400' : 'text-gray-500'
                      }`}
                    >
                      [{idx}]
                    </span>

                    {/* Slot Cell Box */}
                    <div
                      className={`relative flex min-h-[38px] flex-1 items-center justify-between rounded border px-2 py-1 font-mono text-xs transition-colors ${
                        isHoveredSlot
                          ? 'border-indigo-400 bg-indigo-950/60 ring-2 ring-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.4)]'
                          : isOccupied
                            ? isSlotChanged
                              ? 'border-amber-400/80 bg-amber-950/40 ring-1 ring-amber-400/50'
                              : isTop
                                ? 'border-indigo-400/80 bg-indigo-950/40 shadow-[0_0_8px_rgba(99,102,241,0.25)]'
                                : 'border-white/20 bg-canvas-card'
                            : isStale
                              ? 'border-dashed border-amber-500/40 bg-amber-950/20 opacity-70'
                              : 'border-dashed border-white/15 bg-white/[0.02] text-gray-600'
                      }`}
                    >
                      {/* Cell Content */}
                      {isOccupied && val ? (
                        <motion.div
                          key={`occupied-${idx}`}
                          initial={
                            isJustPushed && !shouldReduceMotion
                              ? { y: -16, opacity: 0 }
                              : false
                          }
                          animate={{ y: 0, opacity: 1 }}
                          transition={{ duration, ease: 'easeOut' }}
                          className="flex items-center"
                        >
                          <ValueView
                            value={val}
                            type={arrayObj?.elemType}
                            heap={heap}
                            isChanged={isSlotChanged}
                            prevValue={prevVal}
                            onHoverRef={onHoverRef}
                            onClickRef={onClickRef}
                          />
                        </motion.div>
                      ) : isStale && val ? (
                        // Honest diff: Slot left behind after pop shown faintly with stale indicator
                        <div className="flex w-full items-center justify-between">
                          <div className="flex items-center opacity-60">
                            <ValueView
                              value={val}
                              type={arrayObj?.elemType}
                              heap={heap}
                              onHoverRef={onHoverRef}
                              onClickRef={onClickRef}
                            />
                          </div>
                          <span
                            data-testid="stale-slot-marker"
                            className="rounded bg-amber-900/60 px-1 py-0.2 text-[9px] font-mono text-amber-300 italic"
                          >
                            (stale)
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] italic text-gray-600">
                          (empty slot)
                        </span>
                      )}

                      {/* Floating Pop Animation: slides upward and fades out */}
                      {isJustPopped && !shouldReduceMotion && val && (
                        <motion.div
                          data-testid="stack-pop-animation"
                          className="pointer-events-none absolute inset-x-1 -top-1 z-20 flex items-center justify-center rounded border border-rose-500/60 bg-rose-950/90 px-1.5 py-0.5 text-[10px] font-bold text-rose-200 shadow-lg"
                          initial={{ y: 0, opacity: 1 }}
                          animate={{ y: -22, opacity: 0 }}
                          transition={{ duration, ease: 'easeOut' }}
                        >
                          <span>popped</span>
                        </motion.div>
                      )}
                    </div>

                    {/* Right: Markers (top pointer & other local variables) */}
                    <div className="flex w-20 items-center gap-1">
                      {isTop && (
                        <motion.span
                          data-testid="stack-top-marker"
                          animate={
                            isTopMarkerChanged && !shouldReduceMotion
                              ? { scale: [1, 1.15, 1] }
                              : { scale: 1 }
                          }
                          transition={{ duration }}
                          className={`flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold shadow-sm transition-colors ${
                            isTopMarkerChanged
                              ? 'border-amber-400 bg-amber-900/80 text-amber-200 ring-2 ring-amber-400/50'
                              : 'border-indigo-500/50 bg-indigo-950/80 text-indigo-300'
                          }`}
                          title="Stack top pointer"
                        >
                          <span>←</span>
                          <span>top</span>
                        </motion.span>
                      )}
                      {otherMarkers
                        .filter((m) => m !== 'top')
                        .map((mVar) => (
                          <span
                            key={mVar}
                            className="rounded border border-blue-500/40 bg-blue-950/60 px-1 py-0.5 font-mono text-[9px] text-blue-300"
                          >
                            {mVar}
                          </span>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Base of the stack (solid bottom container plate) */}
            <div className="flex w-56 flex-col items-center">
              <div className="h-1 w-full rounded-b border-b-2 border-indigo-500/60 bg-indigo-500/30" />
              <span className="mt-1 font-mono text-[9px] uppercase tracking-wider text-gray-500">
                Stack Bottom (index 0)
              </span>
            </div>
          </div>

          {/* Side-by-side Raw Array View when toggled */}
          {showRawArray && arrayObj && (
            <div
              data-testid="stack-raw-array-container"
              className="flex flex-col rounded-lg border border-white/10 bg-black/20 p-3"
            >
              <div className="mb-2 font-mono text-xs font-semibold text-gray-400">
                Raw Array View ({arrayObj.elemType}[{arrayObj.length}])
              </div>
              <ArrayView
                id={structure.arrayId}
                obj={arrayObj}
                name={structure.name ? `${structure.name}.data` : 'data'}
                markers={markers}
                changes={arrayChanges}
                isHovered={isHovered}
                isFocused={isFocused}
                onHoverRef={onHoverRef}
                onClickRef={onClickRef}
              />
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // -------------------------------------------------------------------------
  // 2. Node-backed Stack Rendering
  // -------------------------------------------------------------------------
  const nodeIds = structure.allNodeIds || [];
  const isEmpty = structure.isEmpty || nodeIds.length === 0;
  const ghostNodes = stackDiff?.ghostNodes || [];

  return (
    <motion.div
      {...containerMotion}
      id={`heap-${structure.id.replace(/[@:]/g, '_')}`}
      data-testid={`stack-view-${structure.id.replace(/[@:]/g, '_')}`}
      className={`flex flex-col rounded-xl border bg-canvas-subtle p-4 shadow-sm transition-all ${
        isFocused
          ? 'border-indigo-400 ring-2 ring-indigo-500/40'
          : isHovered
            ? 'border-indigo-500/40 ring-1 ring-indigo-500/20'
            : 'border-white/10'
      } ${className}`}
    >
      {/* Structure Header */}
      <StructureHeader
        id={structure.id}
        kind="stack"
        backing="node"
        confidence={structure.confidence}
        reasons={structure.reasons}
        className_={structure.className}
        variableName={structure.name}
        objectId={structure.wrapper?.id}
        nonStructuralFields={structure.wrapper?.nonNodeFields}
        badges={{
          isEmpty,
          isFull: false,
        }}
        changedFields={stackDiff?.changedMarkers}
        showRawArrayToggle={false}
        onViewOverride={onViewOverride}
      />

      {/* Vertical Node Chain */}
      <div className="flex flex-col items-center gap-2 py-2">
        {/* Top entry pointer badge */}
        <div className="flex items-center gap-1.5">
          <motion.span
            data-testid="node-stack-top-chip"
            animate={
              stackDiff?.changedMarkers.has('top') && !shouldReduceMotion
                ? { scale: [1, 1.15, 1] }
                : { scale: 1 }
            }
            transition={{ duration }}
            className={`rounded border px-2 py-0.5 font-mono text-xs font-bold transition-colors ${
              stackDiff?.changedMarkers.has('top')
                ? 'border-amber-400 bg-amber-950/80 text-amber-300 ring-2 ring-amber-400/50'
                : 'border-indigo-500/40 bg-indigo-950/70 text-indigo-300'
            }`}
          >
            top
          </motion.span>
          <span className="font-mono text-xs text-indigo-400">↓</span>
        </div>

        {/* Ghost node (popped/orphaned node) dimmed for 1 step */}
        {ghostNodes.map((ghost) => (
          <motion.div
            key={`ghost-${ghost.id}`}
            data-testid={`ghost-node-${ghost.id.replace('@', '')}`}
            initial={shouldReduceMotion ? false : { opacity: 0.8, y: 0 }}
            animate={{ opacity: 0.4 }}
            className="flex min-w-[130px] items-center justify-between gap-3 rounded-lg border border-dashed border-rose-500/40 bg-rose-950/20 px-3 py-1.5 font-mono text-xs text-gray-400 opacity-50"
          >
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500">{ghost.id}</span>
              <span className="text-gray-300">{ghost.valString}</span>
            </div>
            <span className="text-[10px] italic text-rose-400">(popped)</span>
          </motion.div>
        ))}

        {isEmpty && ghostNodes.length === 0 ? (
          <div
            data-testid="node-stack-empty"
            className="rounded border border-dashed border-white/15 px-4 py-3 font-mono text-xs text-gray-500"
          >
            top → null (empty stack)
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            {nodeIds.map((nId) => {
              const nodeObj = heap[nId];
              if (!nodeObj || nodeObj.kind !== 'object') return null;

              let valEntry: Value | undefined;
              for (const [k, v] of Object.entries(nodeObj.fields)) {
                if (/val|data|item|elem|value/i.test(k)) {
                  valEntry = v;
                  break;
                }
              }
              if (!valEntry) {
                valEntry = Object.values(nodeObj.fields)[0];
              }

              const isNodeFocused = focusedHeapId === nId;
              const isNodeHovered =
                hoveredHeapId === nId ||
                (hoveredFrameNodeIds?.has(nId) ?? false) ||
                Boolean(
                  hoveredVariableName &&
                    selectedFrame?.locals.some(
                      (l) => l.name === hoveredVariableName && l.value.k === 'ref' && l.value.id === nId,
                    ),
                );
              const isNewlyAdded = stackDiff?.addedNodeIds.has(nId);

              return (
                <React.Fragment key={nId}>
                  {/* Node Box */}
                  <motion.div
                    id={`heap-${nId.replace('@', '')}`}
                    data-testid={`stack-node-${nId.replace('@', '')}`}
                    initial={
                      isNewlyAdded && !shouldReduceMotion
                        ? { y: -20, opacity: 0 }
                        : false
                    }
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration, ease: 'easeOut' }}
                    onClick={() => onClickRef?.(nId)}
                    onMouseEnter={() => onHoverRef?.(nId)}
                    onMouseLeave={() => onHoverRef?.(null)}
                    className={`flex min-w-[130px] cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 font-mono text-xs transition-colors ${
                      isNodeFocused
                        ? 'border-indigo-400 bg-indigo-950/50 ring-2 ring-indigo-500/40'
                        : isNodeHovered
                          ? 'border-indigo-400/80 bg-indigo-950/30'
                          : isNewlyAdded
                            ? 'border-emerald-400/80 bg-emerald-950/30 ring-1 ring-emerald-400/50'
                            : 'border-white/15 bg-canvas-card'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-[10px] text-gray-500">{nId}</span>
                      {valEntry && (
                        <ValueView
                          value={valEntry}
                          heap={heap}
                          onHoverRef={onHoverRef}
                          onClickRef={onClickRef}
                        />
                      )}
                    </div>
                    <span className="text-[10px] text-gray-400">Node</span>
                  </motion.div>

                  {/* Down arrow connecting to next node or null */}
                  <div className="flex items-center text-xs text-gray-500">
                    <span>↓</span>
                  </div>
                </React.Fragment>
              );
            })}
            <div className="font-mono text-xs text-gray-500">null</div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
