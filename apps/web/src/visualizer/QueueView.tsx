import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { QueueStructure, StructureOverride } from '../recognition/types';
import type { ArrayObject, HeapObject, StackFrame, Value } from '../trace/types';
import type { StepDiff } from './diff';
import {
  computeQueueDiff,
  getAnimationDuration,
  type QueueDiffResult,
} from './stackQueueDiff';
import { StructureHeader } from './StructureHeader';
import { ValueView } from './ValueView';
import { ArrayView } from './ArrayView';
import { computeIndexMarkers } from './indexMarkers';
import { useAppStore } from '../store';

export interface QueueViewProps {
  structure: QueueStructure;
  prevStructure?: QueueStructure;
  heap: Record<string, HeapObject>;
  prevHeap?: Record<string, HeapObject>;
  selectedFrame?: StackFrame;
  diff?: StepDiff;
  diffResult?: QueueDiffResult;
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

export const QueueView: React.FC<QueueViewProps> = ({
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
  const queueDiff =
    diffResult ??
    (prevStructure
      ? computeQueueDiff(prevStructure, structure, prevHeap, heap, {
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
  // 1. Array-backed Queue (Linear or Circular)
  // -------------------------------------------------------------------------
  if (structure.backing === 'array' && structure.arrayId) {
    const arrayObj = heap[structure.arrayId] as ArrayObject | undefined;
    const arrayLength = structure.arrayLength ?? arrayObj?.length ?? 0;
    const frontIndex = structure.frontIndex ?? 0;
    const rearIndex = structure.rearIndex ?? 0;
    const occupiedSet = new Set(structure.occupiedSlots);
    const isCircular =
      structure.variant === 'circularGap' || structure.variant === 'circularCount';
    const isLinear = structure.variant === 'linear';

    // Cell changes from diff
    const arrayChanges = diff?.changedHeap.get(structure.arrayId)?.arrayChanges ?? [];
    const changeMap = new Map<number, Value>();
    for (const c of arrayChanges) {
      changeMap.set(c.index, c.prev);
    }

    // Capacity clipping: up to 30 slots
    const MAX_DISPLAY_SLOTS = 30;
    const isClipped = arrayLength > MAX_DISPLAY_SLOTS;
    const displaySlotCount = isClipped ? MAX_DISPLAY_SLOTS : arrayLength;

    const slotIndices: number[] = [];
    for (let i = 0; i < displaySlotCount; i++) {
      slotIndices.push(i);
    }

    // Local variable markers from stack frame
    const markers = selectedFrame
      ? computeIndexMarkers(selectedFrame, arrayLength)
      : [];
    const markersByCell = new Map<number, string[]>();
    for (const m of markers) {
      const arr = markersByCell.get(m.cellIndex) ?? [];
      arr.push(m.variableName);
      markersByCell.set(m.cellIndex, arr);
    }

    // Wrap connector dimensions for circular queue
    const cellWidth = 56; // approximate slot width + gap in px
    const startX = (displaySlotCount - 1) * cellWidth + 28;
    const endX = 28;
    const totalWrapWidth = displaySlotCount * cellWidth;

    return (
      <motion.div
        {...containerMotion}
        id={`heap-${structure.id.replace(/[@:]/g, '_')}`}
        data-testid={`queue-view-${structure.id.replace(/[@:]/g, '_')}`}
        className={`flex flex-col rounded-xl border bg-canvas-subtle p-4 shadow-sm transition-all ${
          isFocused
            ? 'border-emerald-400 ring-2 ring-emerald-500/40'
            : isHovered
              ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
              : 'border-white/10'
        } ${className}`}
      >
        {/* Structure Header */}
        <StructureHeader
          id={structure.id}
          kind="queue"
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
            count: structure.count,
            hasWrapped: structure.hasWrapped,
            isResized: queueDiff?.isResized || structure.isResized,
            resizeInfo: queueDiff?.resizeInfo,
          }}
          changedFields={queueDiff?.changedMarkers}
          showRawArrayToggle={true}
          showRawArray={showRawArray}
          onToggleRawArray={() => setShowRawArray((prev) => !prev)}
          onViewOverride={onViewOverride}
        />

        {/* Capacity clipping notification */}
        {isClipped && (
          <div
            data-testid="queue-clipped-notice"
            className="mb-2 rounded border border-amber-500/30 bg-amber-950/30 px-2 py-0.5 text-center text-[10px] text-amber-300"
          >
            Clipped: showing first {MAX_DISPLAY_SLOTS} of {arrayLength} slots
          </div>
        )}

        {/* Horizontal Row of Queue Cells */}
        <div className="flex flex-col overflow-x-auto pb-2 pt-1">
          <div
            data-testid="queue-cells-container"
            className="flex items-start gap-1 pb-1"
          >
            {slotIndices.map((idx) => {
              const isOccupied = occupiedSet.has(idx);
              const isLinearConsumed = isLinear && idx < frontIndex;
              const isFront = idx === frontIndex;
              const isRear = idx === rearIndex;
              const val = arrayObj?.items[idx];
              const isCellMutated = changeMap.has(idx);
              const isSlotChanged =
                isCellMutated ||
                (queueDiff?.changedSlots.has(idx) ?? false) ||
                queueDiff?.writtenSlot === idx;
              const prevVal = changeMap.get(idx);
              const otherMarkers = markersByCell.get(idx) || [];

              // Honest Diffs: Stale slot detection (consumed linear queue cells or dequeued cells)
              const isStale = isLinearConsumed || (queueDiff?.staleSlots.has(idx) ?? false);

              // Enqueue / Dequeue animations
              const isJustEnqueued =
                queueDiff?.op === 'enqueue' &&
                (queueDiff?.enqueuedSlot === idx || queueDiff?.writtenSlot === idx);
              const isJustDequeued =
                queueDiff?.op === 'dequeue' && queueDiff?.dequeuedSlot === idx;

              const isFrontChanged = isFront && queueDiff?.changedMarkers.has('front');
              const isRearChanged = isRear && queueDiff?.changedMarkers.has('rear');

              // Call-stack & Variable Hover Highlight (Stage 7)
              const isHoveredSlot =
                Boolean(hoveredVariableName && markersByCell.get(idx)?.includes(hoveredVariableName)) ||
                Boolean(hoveredFrame && hoveredFrame.locals.some((l) => l.value.k === 'prim' && l.value.v === idx));

              return (
                <div
                  key={idx}
                  data-testid={`queue-slot-${idx}`}
                  className="relative flex shrink-0 flex-col items-center"
                >
                  {/* Slot Index Label */}
                  <span
                    className={`mb-1 font-mono text-[10px] ${
                      isFront || isRear || isHoveredSlot ? 'font-bold text-emerald-400' : 'text-gray-500'
                    }`}
                  >
                    {idx}
                  </span>

                  {/* Cell Box */}
                  <div
                    className={`relative flex min-h-[44px] min-w-[52px] items-center justify-center rounded border px-2 py-1.5 font-mono text-xs transition-colors ${
                      isHoveredSlot
                        ? 'border-emerald-400 bg-emerald-950/60 ring-2 ring-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                        : isOccupied
                          ? isSlotChanged
                            ? 'border-amber-400/80 bg-amber-950/40 ring-1 ring-amber-400/50'
                            : 'border-emerald-400/70 bg-emerald-950/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                          : isStale
                            ? 'border-dashed border-amber-500/40 bg-amber-950/20 opacity-70'
                            : 'border-dashed border-white/15 bg-white/[0.02] text-gray-600'
                    }`}
                    title={
                      isOccupied
                        ? `Index ${idx} (active item)`
                        : isStale
                          ? `Index ${idx} (stale/consumed)`
                          : `Index ${idx} (free slot)`
                    }
                  >
                    {isOccupied && val ? (
                      <motion.div
                        key={`queue-val-${idx}`}
                        initial={
                          isJustEnqueued && !shouldReduceMotion
                            ? { x: 16, opacity: 0 }
                            : false
                        }
                        animate={{ x: 0, opacity: 1 }}
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
                      // Honest diff: Dequeued/consumed slot still holds value in the array
                      <div className="flex flex-col items-center gap-0.5">
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
                          className="rounded bg-amber-900/60 px-1 py-0.2 text-[8px] font-mono text-amber-300 italic"
                        >
                          {isLinearConsumed ? 'consumed' : 'stale'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-600">empty</span>
                    )}

                    {/* Floating Dequeue Animation: slides out toward front */}
                    {isJustDequeued && !shouldReduceMotion && val && (
                      <motion.div
                        data-testid="queue-dequeue-animation"
                        className="pointer-events-none absolute -left-2 -top-1 z-20 flex items-center justify-center rounded border border-rose-500/60 bg-rose-950/90 px-1.5 py-0.5 text-[9px] font-bold text-rose-200 shadow-lg"
                        initial={{ x: 0, opacity: 1 }}
                        animate={{ x: -22, opacity: 0 }}
                        transition={{ duration, ease: 'easeOut' }}
                      >
                        <span>dequeued</span>
                      </motion.div>
                    )}
                  </div>

                  {/* Below Cell: Pointer Chips (front / rear) */}
                  <div className="mt-1.5 flex flex-col items-center gap-0.5">
                    {/* Non-overlapping markers when front == rear */}
                    {isFront && isRear ? (
                      <div
                        data-testid="queue-front-rear-combined"
                        className="flex flex-col items-center gap-0.5"
                      >
                        <span className="text-[10px] leading-none text-emerald-400">
                          ▲
                        </span>
                        <div className="flex flex-wrap items-center justify-center gap-0.5">
                          <motion.span
                            data-testid="queue-front-marker"
                            animate={
                              isFrontChanged && !shouldReduceMotion
                                ? { scale: [1, 1.15, 1] }
                                : { scale: 1 }
                            }
                            transition={{ duration }}
                            className={`rounded border px-1 py-0.2 font-mono text-[9px] font-bold transition-colors ${
                              isFrontChanged
                                ? 'border-amber-400 bg-amber-900/80 text-amber-200 ring-2 ring-amber-400/50'
                                : 'border-emerald-500/40 bg-emerald-950/80 text-emerald-300'
                            }`}
                            title="Queue front pointer"
                          >
                            front
                          </motion.span>
                          <motion.span
                            data-testid="queue-rear-marker"
                            animate={
                              isRearChanged && !shouldReduceMotion
                                ? { scale: [1, 1.15, 1] }
                                : { scale: 1 }
                            }
                            transition={{ duration }}
                            className={`rounded border px-1 py-0.2 font-mono text-[9px] font-bold transition-colors ${
                              isRearChanged
                                ? 'border-amber-400 bg-amber-900/80 text-amber-200 ring-2 ring-amber-400/50'
                                : 'border-cyan-500/40 bg-cyan-950/80 text-cyan-300'
                            }`}
                            title="Queue rear pointer"
                          >
                            rear
                          </motion.span>
                        </div>
                      </div>
                    ) : (
                      <>
                        {isFront && (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] leading-none text-emerald-400">
                              ▲
                            </span>
                            <motion.span
                              data-testid="queue-front-marker"
                              animate={
                                isFrontChanged && !shouldReduceMotion
                                  ? { scale: [1, 1.15, 1] }
                                  : { scale: 1 }
                              }
                              transition={{ duration }}
                              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold transition-colors ${
                                isFrontChanged
                                  ? 'border-amber-400 bg-amber-900/80 text-amber-200 ring-2 ring-amber-400/50'
                                  : 'border-emerald-500/40 bg-emerald-950/80 text-emerald-300'
                              }`}
                            >
                              front
                            </motion.span>
                          </div>
                        )}
                        {isRear && (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[10px] leading-none text-cyan-400">
                              ▲
                            </span>
                            <motion.span
                              data-testid="queue-rear-marker"
                              animate={
                                isRearChanged && !shouldReduceMotion
                                  ? { scale: [1, 1.15, 1] }
                                  : { scale: 1 }
                              }
                              transition={{ duration }}
                              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold transition-colors ${
                                isRearChanged
                                  ? 'border-amber-400 bg-amber-900/80 text-amber-200 ring-2 ring-amber-400/50'
                                  : 'border-cyan-500/40 bg-cyan-950/80 text-cyan-300'
                              }`}
                            >
                              rear
                            </motion.span>
                          </div>
                        )}
                      </>
                    )}

                    {/* Other variable markers on this slot */}
                    {otherMarkers
                      .filter((m) => m !== 'front' && m !== 'rear')
                      .map((mVar) => (
                        <span
                          key={mVar}
                          className="rounded border border-blue-500/30 bg-blue-950/50 px-1 py-0.2 font-mono text-[9px] text-blue-300"
                        >
                          {mVar}
                        </span>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Circular Queue Wraparound SVG Connector when wrapped or during wrap transition */}
          {isCircular && (structure.hasWrapped || queueDiff?.isWrapTransition) && (
            <div
              data-testid="queue-wrap-connector"
              className="mt-2 flex flex-col items-start px-2"
            >
              <svg
                width={Math.max(totalWrapWidth, 200)}
                height="46"
                className="overflow-visible"
              >
                <defs>
                  <marker
                    id="wrap-arrow"
                    viewBox="0 0 10 10"
                    refX="5"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path
                      d="M 0 1 L 10 5 L 0 9 z"
                      fill={queueDiff?.isWrapTransition ? '#e879f9' : '#a855f7'}
                    />
                  </marker>
                </defs>

                {/* Curved loop from end slot underneath back to slot 0 */}
                <path
                  d={`M ${startX} 5 C ${startX} 38, ${endX} 38, ${endX} 8`}
                  fill="none"
                  stroke={queueDiff?.isWrapTransition ? '#e879f9' : '#a855f7'}
                  strokeWidth={queueDiff?.isWrapTransition ? '3' : '2'}
                  strokeDasharray={queueDiff?.isWrapTransition ? undefined : '4 2'}
                  markerEnd="url(#wrap-arrow)"
                  className={queueDiff?.isWrapTransition ? 'filter drop-shadow-[0_0_6px_#a855f7]' : ''}
                />

                {/* Badge text along loop */}
                <rect
                  x={(startX + endX) / 2 - 44}
                  y="24"
                  width="88"
                  height="16"
                  rx="3"
                  className={
                    queueDiff?.isWrapTransition
                      ? 'fill-purple-950/95 stroke-purple-400'
                      : 'fill-zinc-950/90 stroke-purple-500/40'
                  }
                  strokeWidth="1"
                />
                <text
                  x={(startX + endX) / 2}
                  y="36"
                  textAnchor="middle"
                  className={`${
                    queueDiff?.isWrapTransition
                      ? 'fill-purple-200 font-bold'
                      : 'fill-purple-300'
                  } font-mono text-[10px] font-semibold`}
                >
                  {queueDiff?.isWrapTransition
                    ? `${queueDiff.wrappedMarker ?? 'rear'} wraps to 0`
                    : 'wraps to 0'}
                </text>
              </svg>
            </div>
          )}
        </div>

        {/* Side-by-side Raw Array View when toggled */}
        {showRawArray && arrayObj && (
          <div
            data-testid="queue-raw-array-container"
            className="mt-3 flex flex-col rounded-lg border border-white/10 bg-black/20 p-3"
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
      </motion.div>
    );
  }

  // -------------------------------------------------------------------------
  // 2. Node-backed Queue Rendering
  // -------------------------------------------------------------------------
  const nodeIds = structure.allNodeIds || [];
  const isEmpty = structure.isEmpty || nodeIds.length === 0;
  const ghostNodes = queueDiff?.ghostNodes || [];

  return (
    <motion.div
      {...containerMotion}
      id={`heap-${structure.id.replace(/[@:]/g, '_')}`}
      data-testid={`queue-view-${structure.id.replace(/[@:]/g, '_')}`}
      className={`flex flex-col rounded-xl border bg-canvas-subtle p-4 shadow-sm transition-all ${
        isFocused
          ? 'border-emerald-400 ring-2 ring-emerald-500/40'
          : isHovered
            ? 'border-emerald-500/40 ring-1 ring-emerald-500/20'
            : 'border-white/10'
      } ${className}`}
    >
      {/* Structure Header */}
      <StructureHeader
        id={structure.id}
        kind="queue"
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
        changedFields={queueDiff?.changedMarkers}
        showRawArrayToggle={false}
        onViewOverride={onViewOverride}
      />

      {/* Horizontal Node Chain */}
      <div className="flex flex-col gap-2 overflow-x-auto py-2">
        {isEmpty && ghostNodes.length === 0 ? (
          <div
            data-testid="node-queue-empty"
            className="rounded border border-dashed border-white/15 px-4 py-3 font-mono text-xs text-gray-500"
          >
            front → null, rear → null (empty queue)
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Ghost node (dequeued node orphaned for 1 step) */}
            {ghostNodes.map((ghost) => (
              <motion.div
                key={`ghost-${ghost.id}`}
                data-testid={`ghost-node-${ghost.id.replace('@', '')}`}
                initial={shouldReduceMotion ? false : { opacity: 0.8, x: 0 }}
                animate={{ opacity: 0.4 }}
                className="flex shrink-0 items-center justify-between gap-2 rounded-lg border border-dashed border-rose-500/40 bg-rose-950/20 px-3 py-1.5 font-mono text-xs text-gray-400 opacity-50"
              >
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-500">{ghost.id}</span>
                  <span className="text-gray-300">{ghost.valString}</span>
                </div>
                <span className="text-[10px] italic text-rose-400">(dequeued)</span>
              </motion.div>
            ))}

            {nodeIds.map((nId, idx) => {
              const nodeObj = heap[nId];
              if (!nodeObj || nodeObj.kind !== 'object') return null;

              const isFrontNode = idx === 0;
              const isRearNode = idx === nodeIds.length - 1;
              const isNewlyAdded = queueDiff?.addedNodeIds.has(nId);

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

              return (
                <React.Fragment key={nId}>
                  <div className="flex shrink-0 flex-col items-center gap-1">
                    {/* Node Box */}
                    <motion.div
                      id={`heap-${nId.replace('@', '')}`}
                      data-testid={`queue-node-${nId.replace('@', '')}`}
                      initial={
                        isNewlyAdded && !shouldReduceMotion
                          ? { x: 20, opacity: 0 }
                          : false
                      }
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ duration, ease: 'easeOut' }}
                      onClick={() => onClickRef?.(nId)}
                      onMouseEnter={() => onHoverRef?.(nId)}
                      onMouseLeave={() => onHoverRef?.(null)}
                      className={`flex min-w-[120px] cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2 font-mono text-xs transition-colors ${
                        isNodeFocused
                          ? 'border-emerald-400 bg-emerald-950/50 ring-2 ring-emerald-500/40'
                          : isNodeHovered
                            ? 'border-emerald-400/80 bg-emerald-950/30'
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

                    {/* Chips below: front and rear indicators */}
                    <div className="flex items-center gap-1">
                      {isFrontNode && (
                        <motion.span
                          data-testid="node-queue-front-chip"
                          animate={
                            queueDiff?.changedMarkers.has('front') && !shouldReduceMotion
                              ? { scale: [1, 1.15, 1] }
                              : { scale: 1 }
                          }
                          transition={{ duration }}
                          className={`rounded border px-1.5 py-0.2 font-mono text-[9px] font-bold ${
                            queueDiff?.changedMarkers.has('front')
                              ? 'border-amber-400 bg-amber-950/80 text-amber-300 ring-2 ring-amber-400/50'
                              : 'border-emerald-500/40 bg-emerald-950/70 text-emerald-300'
                          }`}
                        >
                          front
                        </motion.span>
                      )}
                      {isRearNode && (
                        <motion.span
                          data-testid="node-queue-rear-chip"
                          animate={
                            queueDiff?.changedMarkers.has('rear') && !shouldReduceMotion
                              ? { scale: [1, 1.15, 1] }
                              : { scale: 1 }
                          }
                          transition={{ duration }}
                          className={`rounded border px-1.5 py-0.2 font-mono text-[9px] font-bold ${
                            queueDiff?.changedMarkers.has('rear')
                              ? 'border-amber-400 bg-amber-950/80 text-amber-300 ring-2 ring-amber-400/50'
                              : 'border-cyan-500/40 bg-cyan-950/70 text-cyan-300'
                          }`}
                        >
                          rear
                        </motion.span>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Arrow between nodes */}
                  <div className="flex shrink-0 items-center text-xs text-gray-500">
                    <span>→</span>
                  </div>
                </React.Fragment>
              );
            })}
            <div className="shrink-0 font-mono text-xs text-gray-500">null</div>
          </div>
        )}
      </div>
    </motion.div>
  );
};
