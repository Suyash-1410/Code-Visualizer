import React, { useState, useMemo } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { HeapStructure, StructureOverride } from '../recognition/types';
import type { ArrayObject, HeapObject, StackFrame } from '../trace/types';
import type { StepDiff } from './diff';
import { StructureHeader } from './StructureHeader';
import { HeapArrayView } from './heap/HeapArrayView';
import { HeapTreeView } from './heap/HeapTreeView';
import { findHeapViolations } from '../recognition/heapMath';
import {
  computeHeapDiff,
  getHeapAnimationDuration,
  type HeapDiffResult,
} from './heap/heapDiff';
import { useAppStore } from '../store';
import { AlertCircle } from 'lucide-react';

export interface HeapViewProps {
  structure: HeapStructure;
  prevStructure?: HeapStructure;
  heap: Record<string, HeapObject>;
  prevHeap?: Record<string, HeapObject>;
  selectedFrame?: StackFrame;
  diff?: StepDiff;
  diffResult?: HeapDiffResult;
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

class TreeErrorBoundary extends React.Component<
  { fallback: (err: Error) => React.ReactNode; children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { fallback: (err: Error) => React.ReactNode; children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error) {
    // Graceful error logging
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback(this.state.error);
    }
    return this.props.children;
  }
}

export const HeapView: React.FC<HeapViewProps> = ({
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
  hoveredFrameNodeIds: _hoveredFrameNodeIds,
  onHoverRef,
  onClickRef,
  onViewOverride,
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();
  const speed = useAppStore((s) => s.playback?.speed ?? 1);
  const isPlaying = useAppStore((s) => s.playback?.isPlaying ?? false);
  const duration = getHeapAnimationDuration(
    speed,
    isPlaying,
    Boolean(shouldReduceMotion),
  );

  // Synchronized hover and focus state across Array and Tree views
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Invariant violations toggle (default off)
  const [showViolations, setShowViolations] = useState(false);

  const arrayObj = heap[structure.arrayId] as ArrayObject | undefined;
  const arrayLength = structure.arrayLength ?? arrayObj?.length ?? 0;

  // Smart heap size default for bare arrays or overrides
  const isBareArray = !structure.wrapper;

  // Find in-scope candidate int local (like n or size) from selectedFrame if bare array
  const defaultLocalSize = useMemo(() => {
    if (!selectedFrame || !isBareArray) return undefined;
    for (const local of selectedFrame.locals) {
      if (
        local.value.k === 'prim' &&
        typeof local.value.v === 'number' &&
        /^(n|size|heapSize|len)$/i.test(local.name)
      ) {
        const val = Math.floor(local.value.v);
        if (val >= 0 && val <= arrayLength) return val;
      }
    }
    return undefined;
  }, [selectedFrame, isBareArray, arrayLength]);

  const [customHeapSize, setCustomHeapSize] = useState<number | null>(null);

  const effectiveSize = Math.max(
    0,
    Math.min(
      arrayLength,
      customHeapSize !== null
        ? customHeapSize
        : structure.size !== undefined
          ? structure.size
          : defaultLocalSize !== null && defaultLocalSize !== undefined
            ? defaultLocalSize
            : arrayLength,
    ),
  );

  // Compute structure-level diff for heap animation
  const heapDiff = useMemo(() => {
    return (
      diffResult ??
      (prevStructure || structure
        ? computeHeapDiff(
            prevStructure,
            structure,
            prevHeap,
            heap,
            selectedFrame,
            { isBackward },
          )
        : undefined)
    );
  }, [
    diffResult,
    prevStructure,
    structure,
    prevHeap,
    heap,
    selectedFrame,
    isBackward,
  ]);

  // Compute violations dynamically for the current effective prefix [0, effectiveSize)
  const effectiveViolations = useMemo(() => {
    if (!arrayObj) return structure.violations ?? [];
    if (effectiveSize === structure.size) {
      return structure.violations ?? [];
    }
    return findHeapViolations(arrayObj.items, effectiveSize, structure.heapType);
  }, [arrayObj, effectiveSize, structure.size, structure.violations, structure.heapType]);

  const isUnknownHeapType = structure.heapType === 'unknown';

  const isFocused =
    focusedHeapId === structure.id || focusedHeapId === structure.arrayId;
  const isHovered =
    hoveredHeapId === structure.id || hoveredHeapId === structure.arrayId;

  // Changes for array cells from diff
  const arrayChanges = diff?.changedHeap.get(structure.arrayId)?.arrayChanges ?? [];

  // Extra toolbar controls to pass into StructureHeader
  const extraControls = (
    <div className="flex flex-wrap items-center gap-2">
      {/* Bare Array Heap Size Control */}
      {isBareArray && (
        <div
          data-testid="heap-size-control"
          className="flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-gray-300"
          title="Bare array heap: adjust heap size to visualize the shrinking heap during Heap Sort."
        >
          <span className="font-mono text-gray-400">heap size:</span>
          <input
            type="range"
            min={0}
            max={arrayLength}
            value={effectiveSize}
            onChange={(e) => setCustomHeapSize(Number(e.target.value))}
            data-testid="heap-size-slider"
            className="h-1.5 w-16 cursor-pointer accent-amber-400"
          />
          <span className="font-mono font-bold text-amber-300">{effectiveSize}</span>
          <span className="text-[10px] text-gray-500">/{arrayLength}</span>
        </div>
      )}

      {/* Violation Hint Toggle */}
      <button
        type="button"
        data-testid="violation-toggle"
        disabled={isUnknownHeapType}
        onClick={() => setShowViolations((prev) => !prev)}
        className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
          isUnknownHeapType
            ? 'cursor-not-allowed border-white/5 bg-white/5 text-gray-600 opacity-50'
            : showViolations
              ? 'border-amber-500/60 bg-amber-950/70 text-amber-200 ring-1 ring-amber-400/40'
              : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
        }`}
        title={
          isUnknownHeapType
            ? 'Disabled: heap type (min or max) is unknown'
            : showViolations
              ? 'Hide heap-property violations'
              : 'Highlight heap-property violations'
        }
      >
        <AlertCircle className="h-3 w-3" />
        <span>Highlight violations</span>
        {showViolations && effectiveViolations.length > 0 && (
          <span className="ml-0.5 rounded-full bg-amber-500/30 px-1 text-[9px] font-bold text-amber-300">
            {effectiveViolations.length}
          </span>
        )}
      </button>
    </div>
  );

  if (!arrayObj) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-xs text-red-300">
        Underlying array object ({structure.arrayId}) not found in heap.
      </div>
    );
  }

  return (
    <div
      id={`heap-${structure.id.replace('@', '')}`}
      data-testid={`heap-view-${structure.id}`}
      className={`rounded-lg border bg-canvas-subtle p-3.5 shadow-sm transition-all ${
        isFocused
          ? 'border-blue-400 ring-2 ring-blue-500/40'
          : isHovered
            ? 'border-violet-400 ring-1 ring-violet-500/30'
            : 'border-white/10'
      } ${className}`}
    >
      {/* 1. Header with Detection label, reasons popover, badges, controls, ViewAsMenu */}
      <StructureHeader
        id={structure.id}
        kind="heap"
        backing="array"
        heapType={structure.heapType}
        confidence={structure.confidence}
        reasons={structure.reasons}
        className_={structure.className}
        variableName={structure.name}
        objectId={structure.wrapper?.id}
        badges={{
          isEmpty: effectiveSize === 0,
          isFull: effectiveSize >= arrayLength,
          isResized: heapDiff?.isResized || structure.isResized,
          resizeInfo: heapDiff?.resizeInfo,
        }}
        changedFields={heapDiff?.changedMarkers}
        extraControls={extraControls}
        onViewOverride={onViewOverride}
      />

      {/* Bare Array Educational Hint in UI */}
      {isBareArray && (
        <div
          data-testid="bare-array-doc"
          className="mb-2 text-[10px] text-gray-400 italic"
        >
          Bare array heap: adjust heap size to visualize the shrinking heap during Heap Sort.
        </div>
      )}

      {/* 2. HeapArrayView (top) */}
      <div className="mb-3">
        <HeapArrayView
          id={structure.arrayId}
          obj={arrayObj}
          name={structure.name}
          size={effectiveSize}
          selectedFrame={selectedFrame}
          changes={arrayChanges}
          heapDiff={heapDiff}
          duration={duration}
          hoveredIndex={hoveredIndex}
          focusedIndex={focusedIndex}
          hoveredFrame={hoveredFrame}
          hoveredVariableName={hoveredVariableName}
          onHoverIndex={setHoveredIndex}
          onClickIndex={setFocusedIndex}
          onHoverRef={onHoverRef}
          onClickRef={onClickRef}
        />
      </div>

      {/* 3. HeapTreeView (below) with graceful error fallback */}
      <TreeErrorBoundary
        fallback={(err) => (
          <div
            data-testid="tree-error-banner"
            className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-300"
          >
            Tree view could not be rendered: {err.message || 'Unknown error'}. Showing plain array view.
          </div>
        )}
      >
        <HeapTreeView
          arrayObj={arrayObj}
          size={effectiveSize}
          heapType={structure.heapType}
          violations={effectiveViolations}
          showViolations={showViolations}
          selectedFrame={selectedFrame}
          heapDiff={heapDiff}
          duration={duration}
          hoveredIndex={hoveredIndex}
          focusedIndex={focusedIndex}
          hoveredFrame={hoveredFrame}
          hoveredVariableName={hoveredVariableName}
          onHoverIndex={setHoveredIndex}
          onClickIndex={setFocusedIndex}
        />
      </TreeErrorBoundary>
    </div>
  );
};
