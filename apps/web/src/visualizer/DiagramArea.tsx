import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { StackFrame, Step, StaticField, ArrayObject, Value } from '../trace/types';
import type { StepDiff, ArrayChange } from './diff';
import {
  recognize,
  analyzeClassShapes,
  collectReachable,
  type LinkedListStructure,
  type StructureOverride,
} from '../recognition';
import { computeIndexMarkers } from './indexMarkers';
import { ArrayView } from './ArrayView';
import { GridView } from './GridView';
import { ObjectView } from './ObjectView';
import { LinkedListView } from './LinkedListView';
import { TreeView } from './tree/TreeView';
import { StackView } from './StackView';
import { QueueView } from './QueueView';
import { HeapView } from './HeapView';
import { VisualizerErrorBoundary } from './VisualizerErrorBoundary';
import { computeActiveNodes } from './activeNodes';
import { computeTreeActiveNodes } from './tree/treeActiveNodes';
import { computeNodeProgressStates } from './tree/treeProgress';
import { useAppStore, useCurrentStdout } from '../store';

export interface DiagramAreaProps {
  step?: Step;
  prevStep?: Step;
  selectedFrame?: StackFrame;
  statics?: StaticField[];
  diff?: StepDiff;
  isBackward?: boolean;
  hoveredHeapId?: string | null;
  focusedHeapId?: string | null;
  overrides?: Map<string, StructureOverride>;
  onHoverHeap?: (id: string | null) => void;
  onFocusHeap?: (id: string | null) => void;
  onViewOverride?: (id: string, kind: StructureOverride) => void;
}

export const DiagramArea: React.FC<DiagramAreaProps> = ({
  step,
  prevStep,
  selectedFrame,
  statics = [],
  diff,
  isBackward = false,
  hoveredHeapId = null,
  focusedHeapId = null,
  overrides,
  onHoverHeap,
  onFocusHeap,
  onViewOverride,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalOverrides, setInternalOverrides] = useState<
    Map<string, StructureOverride>
  >(new Map());

  const effectiveOverrides = overrides ?? internalOverrides;

  const handleOverride = (id: string, kind: StructureOverride) => {
    if (onViewOverride) {
      onViewOverride(id, kind);
    } else {
      setInternalOverrides((prev) => {
        const next = new Map(prev);
        next.set(id, kind);
        return next;
      });
    }
  };

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

  // Find root reference IDs from selected frame locals + static fields
  const { rootIds, varNamesByHeapId } = useMemo(() => {
    const ids: string[] = [];
    const varNames = new Map<string, string>();

    // PRD 5.3: Objects reachable from any stack frame or static field remain reachable
    if (step?.stack) {
      for (const frame of step.stack) {
        for (const local of frame.locals) {
          if (local.value.k === 'ref') {
            ids.push(local.value.id);
            if (!varNames.has(local.value.id)) {
              varNames.set(local.value.id, local.name);
            }
          }
        }
      }
    }

    for (const s of statics) {
      if (s.value.k === 'ref') {
        ids.push(s.value.id);
        if (!varNames.has(s.value.id)) {
          varNames.set(s.value.id, `${s.class}.${s.name}`);
        }
      }
    }

    return { rootIds: ids, varNamesByHeapId: varNames };
  }, [step?.stack, statics]);

  // Reachable heap IDs
  const reachable = useMemo(
    () => (step?.heap ? collectReachable(rootIds, step.heap) : new Set<string>()),
    [rootIds, step?.heap],
  );

  // Analyze class shapes to determine which generic objects can toggle to linked list
  const classShapes = useMemo(
    () => (step?.heap ? analyzeClassShapes(step.heap) : new Map()),
    [step?.heap],
  );

  const listClassNames = useMemo(() => {
    const set = new Set<string>();
    for (const [name, shape] of classShapes.entries()) {
      if (shape.kind === 'linkedList' || shape.kind === 'doublyLinkedList') {
        set.add(name);
      }
    }
    return set;
  }, [classShapes]);

  // Run data structure recognition
  const recognition = useMemo(
    () =>
      step && step.heap
        ? recognize(step, selectedFrame, effectiveOverrides, prevStep)
        : null,
    [step, selectedFrame, effectiveOverrides, prevStep],
  );

  // Previous step recognition for diff and smooth animation transitions
  const prevRecognition = useMemo(
    () =>
      prevStep && prevStep.heap
        ? recognize(prevStep, undefined, effectiveOverrides)
        : null,
    [prevStep, effectiveOverrides],
  );

  // Group related linked list structures that share the same node class (and no distinct wrapper objects)
  // For example, in reverse linked list, prefix chain (@672) and suffix chain (@673 -> @674 -> @675)
  // are unified into one LinkedListView with multiple chains so the second half never disappears!
  const unifiedStructures = useMemo(() => {
    const list = recognition?.structures ?? [];
    if (list.length <= 1) return list;

    const result: LinkedListStructure[] = [];
    const byClass = new Map<string, LinkedListStructure[]>();

    for (const struct of list) {
      if (struct.wrapper) {
        result.push(struct);
      } else {
        const arr = byClass.get(struct.className) ?? [];
        arr.push(struct);
        byClass.set(struct.className, arr);
      }
    }

    for (const structs of byClass.values()) {
      if (structs.length === 1) {
        result.push(structs[0]);
      } else {
        const primary = structs[0];
        const allChains = structs.flatMap((s) => s.chains);
        const allNodeIds = structs.flatMap((s) => s.allNodeIds);
        const allEntryPoints = structs.flatMap((s) => s.entryPoints);
        const hasCycle = structs.some((s) => s.hasCycle);
        const isFragment = structs.every((s) => s.isFragment);

        result.push({
          kind: primary.kind,
          className: primary.className,
          chains: allChains,
          allNodeIds,
          entryPoints: allEntryPoints,
          wrapper: primary.wrapper,
          confidence: primary.confidence,
          valueField: primary.valueField,
          nextField: primary.nextField,
          prevField: primary.prevField,
          hasCycle,
          isFragment,
        });
      }
    }

    return result;
  }, [recognition?.structures]);

  const prevUnifiedStructures = useMemo(() => {
    const list = prevRecognition?.structures ?? [];
    if (list.length <= 1) return list;

    const result: LinkedListStructure[] = [];
    const byClass = new Map<string, LinkedListStructure[]>();

    for (const struct of list) {
      if (struct.wrapper) {
        result.push(struct);
      } else {
        const arr = byClass.get(struct.className) ?? [];
        arr.push(struct);
        byClass.set(struct.className, arr);
      }
    }

    for (const structs of byClass.values()) {
      if (structs.length === 1) {
        result.push(structs[0]);
      } else {
        const primary = structs[0];
        const allChains = structs.flatMap((s) => s.chains);
        const allNodeIds = structs.flatMap((s) => s.allNodeIds);
        const allEntryPoints = structs.flatMap((s) => s.entryPoints);
        const hasCycle = structs.some((s) => s.hasCycle);
        const isFragment = structs.every((s) => s.isFragment);

        result.push({
          kind: primary.kind,
          className: primary.className,
          chains: allChains,
          allNodeIds,
          entryPoints: allEntryPoints,
          wrapper: primary.wrapper,
          confidence: primary.confidence,
          valueField: primary.valueField,
          nextField: primary.nextField,
          prevField: primary.prevField,
          hasCycle,
          isFragment,
        });
      }
    }

    return result;
  }, [prevRecognition?.structures]);

  const hoveredFrameId = useAppStore((s) => s.hoveredFrameId);
  const selectedFrameId = useAppStore((s) => s.selectedFrameId);
  const hoveredVariableName = useAppStore((s) => s.hoveredVariableName);
  const setHoveredVariableName = useAppStore((s) => s.setHoveredVariableName);
  const trace = useAppStore((s) => s.trace);
  const currentStepIndex = useAppStore((s) => s.currentStepIndex);
  const stdout = useCurrentStdout();

  const activeNodesInfo = useMemo(
    () => computeActiveNodes(step, unifiedStructures),
    [step, unifiedStructures],
  );

  const hoveredFrameNodeIds = useMemo(() => {
    if (hoveredFrameId === null || !step?.stack) return undefined;
    const targetFrame = step.stack.find((f) => f.frameId === hoveredFrameId);
    if (!targetFrame) return undefined;
    const set = new Set<string>();
    for (const l of targetFrame.locals) {
      if (l.value.k === 'ref') set.add(l.value.id);
    }
    return set;
  }, [hoveredFrameId, step?.stack]);

  const hoveredFrame = useMemo(() => {
    if (hoveredFrameId === null || !step?.stack) return undefined;
    return step.stack.find((f) => f.frameId === hoveredFrameId);
  }, [hoveredFrameId, step?.stack]);

  const visibleTrees = useMemo(() => {
    return (recognition?.trees ?? []).filter((tree) => {
      if (tree.nodeCount === 0) return true;
      return (
        tree.allNodeIds.some((id) => reachable.has(id)) ||
        (tree.rootId ? reachable.has(tree.rootId) : false)
      );
    });
  }, [recognition?.trees, reachable]);

  const treeActiveNodesInfo = useMemo(
    () =>
      step
        ? computeTreeActiveNodes(step, visibleTrees)
        : {
            activeNodeId: null,
            suspendedNodeIds: new Set<string>(),
            nodeToFrames: new Map(),
            pathEdgeIds: new Set<string>(),
          },
    [step, visibleTrees],
  );

  const visibleStacks = useMemo(() => {
    return (recognition?.stacks ?? []).filter((stack) => {
      if (stack.backing === 'array' && stack.arrayId) {
        if (reachable.has(stack.arrayId)) return true;
        if (stack.wrapper && reachable.has(stack.wrapper.id)) return true;
        if (effectiveOverrides.has(stack.id)) return true;
        return false;
      }
      if (stack.backing === 'node') {
        if (stack.allNodeIds && stack.allNodeIds.some((id) => reachable.has(id))) return true;
        if (stack.topNodeId && reachable.has(stack.topNodeId)) return true;
        if (stack.wrapper && reachable.has(stack.wrapper.id)) return true;
        if (effectiveOverrides.has(stack.id)) return true;
        return false;
      }
      return true;
    });
  }, [recognition?.stacks, reachable, effectiveOverrides]);

  const visibleQueues = useMemo(() => {
    return (recognition?.queues ?? []).filter((queue) => {
      if (queue.backing === 'array' && queue.arrayId) {
        if (reachable.has(queue.arrayId)) return true;
        if (queue.wrapper && reachable.has(queue.wrapper.id)) return true;
        if (effectiveOverrides.has(queue.id)) return true;
        return false;
      }
      if (queue.backing === 'node') {
        if (queue.allNodeIds && queue.allNodeIds.some((id) => reachable.has(id))) return true;
        if (queue.frontNodeId && reachable.has(queue.frontNodeId)) return true;
        if (queue.wrapper && reachable.has(queue.wrapper.id)) return true;
        if (effectiveOverrides.has(queue.id)) return true;
        return false;
      }
      return true;
    });
  }, [recognition?.queues, reachable, effectiveOverrides]);

  const visibleHeaps = useMemo(() => {
    return (recognition?.heaps ?? []).filter((heap) => {
      if (heap.arrayId) {
        if (reachable.has(heap.arrayId)) return true;
        if (heap.wrapper && reachable.has(heap.wrapper.id)) return true;
        if (effectiveOverrides.has(heap.id)) return true;
        if (effectiveOverrides.has(heap.arrayId)) return true;
        return false;
      }
      return true;
    });
  }, [recognition?.heaps, reachable, effectiveOverrides]);

  if (!step || !step.heap || Object.keys(step.heap).length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center text-xs text-gray-500">
        <span>No heap objects allocated at this step.</span>
      </div>
    );
  }

  if (!recognition) {
    return null;
  }

  const visibleGrids = recognition.grids.filter((g) => reachable.has(g.id));

  const visibleArrays = recognition.arrays.filter((a) => {
    if (!reachable.has(a.id)) return false;
    const name = varNamesByHeapId.get(a.id);
    if (name === 'args' && a.obj.length === 0) return false;
    return true;
  });

  const visibleLeftovers = recognition.leftoverObjectIds.filter((id) => {
    if (reachable.has(id)) return true;
    if (effectiveOverrides.has(id)) return true;
    return false;
  });

  const totalVisibleItems =
    unifiedStructures.length +
    visibleTrees.length +
    visibleStacks.length +
    visibleQueues.length +
    visibleHeaps.length +
    visibleGrids.length +
    visibleArrays.length +
    visibleLeftovers.length;

  if (totalVisibleItems === 0) {
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
      {/* 1. Recognized Linked Lists */}
      {unifiedStructures.map((struct, sIdx) => {
        // Match corresponding previous structure by shared node IDs or className
        const prevStruct =
          prevUnifiedStructures.find(
            (ps) =>
              ps.className === struct.className &&
              ps.allNodeIds.some((id) => struct.allNodeIds.includes(id)),
          ) ??
          prevUnifiedStructures.find((ps) => ps.className === struct.className) ??
          prevUnifiedStructures[sIdx];

        const fallbackViews = struct.allNodeIds.map((id) => {
          const obj = step.heap[id];
          if (!obj || obj.kind !== 'object') return null;
          const isHovered = hoveredHeapId === id;
          const isFocused = focusedHeapId === id;
          const heapChange = diff?.changedHeap.get(id);

          return (
            <ObjectView
              key={id}
              id={id}
              obj={obj}
              name={varNamesByHeapId.get(id)}
              changes={heapChange?.fieldChanges ?? []}
              isHovered={isHovered}
              isFocused={isFocused}
              canViewAsList={true}
              onHoverRef={onHoverHeap}
              onClickRef={onFocusHeap}
              onViewOverride={handleOverride}
            />
          );
        });

        return (
          <VisualizerErrorBoundary
            key={struct.className + (struct.wrapper ? `-${struct.wrapper.id}` : '')}
            fallback={fallbackViews}
            resetKey={step.i}
          >
            <LinkedListView
              structure={struct}
              prevStructure={prevStruct}
              heap={step.heap}
              prevHeap={prevStep?.heap}
              selectedFrame={selectedFrame}
              selectedFrameId={selectedFrameId}
              activeNodeId={activeNodesInfo.activeNodeId}
              suspendedNodeIds={activeNodesInfo.suspendedNodeIds}
              hoveredFrameNodeIds={hoveredFrameNodeIds}
              hoveredHeapId={hoveredHeapId}
              focusedHeapId={focusedHeapId}
              hoveredFrameId={hoveredFrameId}
              hoveredVariableName={hoveredVariableName}
              onHoverRef={onHoverHeap}
              onClickRef={onFocusHeap}
              onHoverVariable={setHoveredVariableName}
              onViewOverride={handleOverride}
            />
          </VisualizerErrorBoundary>
        );
      })}

      {/* 1.5. Binary Trees */}
      {visibleTrees.map((tree, tIdx) => {
        const prevTrees = prevRecognition?.trees ?? [];
        const prevTree =
          prevTrees.find(
            (pt) =>
              pt.className === tree.className &&
              pt.allNodeIds.some((id) => tree.allNodeIds.includes(id)),
          ) ??
          prevTrees.find((pt) => pt.className === tree.className) ??
          prevTrees[tIdx];

        const progressResult = computeNodeProgressStates(
          trace,
          currentStepIndex,
          tree,
          step,
        );

        const fallbackViews = tree.allNodeIds.map((id) => {
          const obj = step.heap[id];
          if (!obj || obj.kind !== 'object') return null;

          return (
            <ObjectView
              key={id}
              id={id}
              obj={obj}
              name={varNamesByHeapId.get(id)}
              isHovered={hoveredHeapId === id}
              isFocused={focusedHeapId === id}
              canViewAsList={true}
              onHoverRef={onHoverHeap}
              onClickRef={onFocusHeap}
              onViewOverride={handleOverride}
            />
          );
        });

        return (
          <VisualizerErrorBoundary
            key={tree.className + (tree.rootId ? `-${tree.rootId}` : '')}
            fallback={fallbackViews}
            fallbackTitle="Binary tree visualizer encountered an issue. Falling back to generic object view."
            resetKey={step.i}
          >
            <TreeView
              structure={tree}
              prevStructure={prevTree}
              heap={step.heap}
              prevHeap={prevStep?.heap}
              selectedFrame={selectedFrame}
              selectedFrameId={selectedFrameId}
              activeNodeId={treeActiveNodesInfo.activeNodeId}
              suspendedNodeIds={treeActiveNodesInfo.suspendedNodeIds}
              pathEdgeIds={treeActiveNodesInfo.pathEdgeIds}
              progressStates={progressResult.states}
              hoveredFrameNodeIds={hoveredFrameNodeIds}
              hoveredHeapId={hoveredHeapId}
              focusedHeapId={focusedHeapId}
              hoveredVariableName={hoveredVariableName}
              stdout={stdout}
              onHoverRef={onHoverHeap}
              onClickRef={onFocusHeap}
              onHoverVariable={setHoveredVariableName}
              onViewOverride={handleOverride}
            />
          </VisualizerErrorBoundary>
        );
      })}

      {/* 1.6. Stacks */}
      {visibleStacks.map((stack) => {
        const prevStack = prevRecognition?.stacks?.find(
          (ps) =>
            ps.id === stack.id ||
            (stack.wrapper && ps.wrapper && ps.wrapper.id === stack.wrapper.id) ||
            (stack.arrayId && ps.arrayId === stack.arrayId),
        );

        const fallbackViews =
          stack.backing === 'array' && stack.arrayId && step.heap[stack.arrayId] ? (
            <ArrayView
              key={stack.arrayId}
              id={stack.arrayId}
              obj={step.heap[stack.arrayId] as ArrayObject}
              name={stack.name}
              isHovered={hoveredHeapId === stack.arrayId}
              isFocused={focusedHeapId === stack.arrayId}
              onHoverRef={onHoverHeap}
              onClickRef={onFocusHeap}
            />
          ) : stack.wrapper && step.heap[stack.wrapper.id] ? (
            <ObjectView
              key={stack.wrapper.id}
              id={stack.wrapper.id}
              obj={step.heap[stack.wrapper.id] as { kind: 'object'; type: string; fields: Record<string, Value> }}
              name={stack.name}
              isHovered={hoveredHeapId === stack.wrapper.id}
              isFocused={focusedHeapId === stack.wrapper.id}
              onHoverRef={onHoverHeap}
              onClickRef={onFocusHeap}
            />
          ) : null;

        return (
          <VisualizerErrorBoundary
            key={`stack-${stack.id}`}
            fallback={fallbackViews}
            fallbackTitle="Stack visualizer encountered an issue. Falling back to array/object view."
            resetKey={step.i}
          >
            <StackView
              structure={stack}
              prevStructure={prevStack}
              heap={step.heap}
              prevHeap={prevStep?.heap}
              selectedFrame={selectedFrame}
              diff={diff}
              isBackward={isBackward}
              hoveredHeapId={hoveredHeapId}
              focusedHeapId={focusedHeapId}
              hoveredFrame={hoveredFrame}
              hoveredVariableName={hoveredVariableName}
              hoveredFrameNodeIds={hoveredFrameNodeIds}
              onHoverRef={onHoverHeap}
              onClickRef={onFocusHeap}
              onViewOverride={handleOverride}
            />
          </VisualizerErrorBoundary>
        );
      })}

      {/* 1.7. Queues */}
      {visibleQueues.map((queue) => {
        const prevQueue = prevRecognition?.queues?.find(
          (pq) =>
            pq.id === queue.id ||
            (queue.wrapper && pq.wrapper && pq.wrapper.id === queue.wrapper.id) ||
            (queue.arrayId && pq.arrayId === queue.arrayId),
        );

        const fallbackViews =
          queue.backing === 'array' && queue.arrayId && step.heap[queue.arrayId] ? (
            <ArrayView
              key={queue.arrayId}
              id={queue.arrayId}
              obj={step.heap[queue.arrayId] as ArrayObject}
              name={queue.name}
              isHovered={hoveredHeapId === queue.arrayId}
              isFocused={focusedHeapId === queue.arrayId}
              onHoverRef={onHoverHeap}
              onClickRef={onFocusHeap}
            />
          ) : queue.wrapper && step.heap[queue.wrapper.id] ? (
            <ObjectView
              key={queue.wrapper.id}
              id={queue.wrapper.id}
              obj={step.heap[queue.wrapper.id] as { kind: 'object'; type: string; fields: Record<string, Value> }}
              name={queue.name}
              isHovered={hoveredHeapId === queue.wrapper.id}
              isFocused={focusedHeapId === queue.wrapper.id}
              onHoverRef={onHoverHeap}
              onClickRef={onFocusHeap}
            />
          ) : null;

        return (
          <VisualizerErrorBoundary
            key={`queue-${queue.id}`}
            fallback={fallbackViews}
            fallbackTitle="Queue visualizer encountered an issue. Falling back to array/object view."
            resetKey={step.i}
          >
            <QueueView
              structure={queue}
              prevStructure={prevQueue}
              heap={step.heap}
              prevHeap={prevStep?.heap}
              selectedFrame={selectedFrame}
              diff={diff}
              isBackward={isBackward}
              hoveredHeapId={hoveredHeapId}
              focusedHeapId={focusedHeapId}
              hoveredFrame={hoveredFrame}
              hoveredVariableName={hoveredVariableName}
              hoveredFrameNodeIds={hoveredFrameNodeIds}
              onHoverRef={onHoverHeap}
              onClickRef={onFocusHeap}
              onViewOverride={handleOverride}
            />
          </VisualizerErrorBoundary>
        );
      })}

      {/* 1.8. Heaps */}
      {visibleHeaps.map((heap) => {
        const prevHeap = prevRecognition?.heaps?.find(
          (ph) =>
            ph.id === heap.id ||
            (heap.wrapper && ph.wrapper && ph.wrapper.id === heap.wrapper.id) ||
            (heap.arrayId && ph.arrayId === heap.arrayId),
        );

        const fallbackViews =
          heap.arrayId && step.heap[heap.arrayId] ? (
            <ArrayView
              key={heap.arrayId}
              id={heap.arrayId}
              obj={step.heap[heap.arrayId] as ArrayObject}
              name={heap.name}
              isHovered={hoveredHeapId === heap.arrayId}
              isFocused={focusedHeapId === heap.arrayId}
              onHoverRef={onHoverHeap}
              onClickRef={onFocusHeap}
            />
          ) : heap.wrapper && step.heap[heap.wrapper.id] ? (
            <ObjectView
              key={heap.wrapper.id}
              id={heap.wrapper.id}
              obj={step.heap[heap.wrapper.id] as { kind: 'object'; type: string; fields: Record<string, Value> }}
              name={heap.name}
              isHovered={hoveredHeapId === heap.wrapper.id}
              isFocused={focusedHeapId === heap.wrapper.id}
              onHoverRef={onHoverHeap}
              onClickRef={onFocusHeap}
            />
          ) : null;

        return (
          <VisualizerErrorBoundary
            key={`heap-${heap.id}`}
            fallback={fallbackViews}
            fallbackTitle="Heap visualizer encountered an issue. Falling back to array view."
            resetKey={step.i}
          >
            <HeapView
              structure={heap}
              prevStructure={prevHeap}
              heap={step.heap}
              prevHeap={prevStep?.heap}
              selectedFrame={selectedFrame}
              diff={diff}
              isBackward={isBackward}
              hoveredHeapId={hoveredHeapId}
              focusedHeapId={focusedHeapId}
              hoveredFrame={hoveredFrame}
              hoveredVariableName={hoveredVariableName}
              hoveredFrameNodeIds={hoveredFrameNodeIds}
              onHoverRef={onHoverHeap}
              onClickRef={onFocusHeap}
              onViewOverride={handleOverride}
            />
          </VisualizerErrorBoundary>
        );
      })}

      {/* 2. 2D Grids */}
      {visibleGrids.map((grid) => {
        const isHovered = hoveredHeapId === grid.id;
        const isFocused = focusedHeapId === grid.id;
        const innerChanges = new Map<string, ArrayChange[]>();
        for (const item of grid.obj.items) {
          if (item.k === 'ref') {
            const ch = diff?.changedHeap.get(item.id);
            if (ch && ch.arrayChanges) {
              innerChanges.set(item.id, ch.arrayChanges);
            }
          }
        }

        return (
          <GridView
            key={grid.id}
            id={grid.id}
            obj={grid.obj}
            innerArrays={grid.innerArrays}
            name={varNamesByHeapId.get(grid.id)}
            innerChanges={innerChanges}
            isHovered={isHovered}
            isFocused={isFocused}
            onHoverRef={onHoverHeap}
            onClickRef={onFocusHeap}
          />
        );
      })}

      {/* 3. 1D Arrays */}
      {visibleArrays.map((arr) => {
        const isHovered = hoveredHeapId === arr.id;
        const isFocused = focusedHeapId === arr.id;
        const markers = selectedFrame
          ? computeIndexMarkers(selectedFrame, arr.obj.length)
          : [];
        const hasStructureHint =
          effectiveOverrides.has(arr.id) ||
          (recognition?.hints && recognition.hints.some((h) => h.targetId === arr.id)) ||
          /heap|stack|queue|sift/i.test(selectedFrame?.method || '') ||
          /heap|stack|queue/i.test(varNamesByHeapId.get(arr.id) || '');
        const heapChange = diff?.changedHeap.get(arr.id);

        return (
          <ArrayView
            key={arr.id}
            id={arr.id}
            obj={arr.obj}
            name={varNamesByHeapId.get(arr.id)}
            markers={markers}
            changes={heapChange?.arrayChanges ?? []}
            isHovered={isHovered}
            isFocused={isFocused}
            canViewAsStructure={Boolean(hasStructureHint)}
            onHoverRef={onHoverHeap}
            onClickRef={onFocusHeap}
            onViewOverride={handleOverride}
          />
        );
      })}

      {/* 4. Leftover Generic Objects */}
      {visibleLeftovers.map((id) => {
        const obj = step.heap[id];
        if (!obj || obj.kind !== 'object') return null;

        const isHovered = hoveredHeapId === id;
        const isFocused = focusedHeapId === id;
        const heapChange = diff?.changedHeap.get(id);
        const canViewAsList =
          listClassNames.has(obj.type) || effectiveOverrides.has(id);

        return (
          <ObjectView
            key={id}
            id={id}
            obj={obj}
            name={varNamesByHeapId.get(id)}
            changes={heapChange?.fieldChanges ?? []}
            isHovered={isHovered}
            isFocused={isFocused}
            canViewAsList={canViewAsList}
            onHoverRef={onHoverHeap}
            onClickRef={onFocusHeap}
            onViewOverride={handleOverride}
          />
        );
      })}
    </div>
  );
};
