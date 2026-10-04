import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import type { Trace } from '../../trace/types';
import { recognize } from '../../recognition';
import {
  computeStackDiff,
  computeQueueDiff,
  getAnimationDuration,
} from '../stackQueueDiff';

describe('Stack and Queue Structure-Level Diff Suite (Phase 4 Stage 4)', () => {
  const loadTrace = (filename: string): Trace => {
    const filePath = path.resolve(
      process.cwd(),
      '../../tests/fixtures/traces',
      filename,
    );
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as Trace;
  };

  // -------------------------------------------------------------------------
  // 1. ArrayStack Diffing & Honest Pop
  // -------------------------------------------------------------------------
  describe('ArrayStack.json fixture', () => {
    const trace = loadTrace('ArrayStack.json');

    it('detects push operation, updated slot, and top marker change', () => {
      // Find step where s.push(10) occurs: top goes from -1 to 0
      let stepPushIdx = -1;
      for (let i = 1; i < trace.steps.length; i++) {
        const prev = recognize(trace.steps[i - 1]).stacks[0];
        const curr = recognize(trace.steps[i]).stacks[0];
        if (prev && curr && (prev.topIndex ?? -1) === -1 && curr.topIndex === 0) {
          stepPushIdx = i;
          break;
        }
      }

      expect(stepPushIdx).toBeGreaterThan(0);
      const prevStep = trace.steps[stepPushIdx - 1];
      const currStep = trace.steps[stepPushIdx];
      const prevStack = recognize(prevStep).stacks[0];
      const currStack = recognize(currStep).stacks[0];

      const diff = computeStackDiff(
        prevStack,
        currStack,
        prevStep.heap,
        currStep.heap,
      );

      expect(diff.op).toBe('push');
      expect(diff.pushedSlot).toBe(0);
      expect(diff.changedMarkers.has('top')).toBe(true);
      expect(diff.changedSlots.has(0)).toBe(true);
      expect(diff.staleSlots.size).toBe(0);
    });

    it('honest diff: detects pop, top decrement, and slot left behind as stale', () => {
      // Find step where pop() occurs: top decreases
      let stepPopIdx = -1;
      for (let i = 1; i < trace.steps.length; i++) {
        const prev = recognize(trace.steps[i - 1]).stacks[0];
        const curr = recognize(trace.steps[i]).stacks[0];
        if (prev && curr && (prev.topIndex ?? -1) > (curr.topIndex ?? -1)) {
          stepPopIdx = i;
          break;
        }
      }

      expect(stepPopIdx).toBeGreaterThan(0);
      const prevStep = trace.steps[stepPopIdx - 1];
      const currStep = trace.steps[stepPopIdx];
      const prevStack = recognize(prevStep).stacks[0];
      const currStack = recognize(currStep).stacks[0];

      const diff = computeStackDiff(
        prevStack,
        currStack,
        prevStep.heap,
        currStep.heap,
      );

      expect(diff.op).toBe('pop');
      expect(diff.poppedSlot).toBe(prevStack.topIndex);
      expect(diff.changedMarkers.has('top')).toBe(true);
      // The popped slot is at prevStack.topIndex and must be marked as stale
      expect(diff.staleSlots.has(prevStack.topIndex!)).toBe(true);
    });

    it('backward stepping: reverses push into pop and pop into push', () => {
      // Forward push
      let stepPushIdx = -1;
      for (let i = 1; i < trace.steps.length; i++) {
        const prev = recognize(trace.steps[i - 1]).stacks[0];
        const curr = recognize(trace.steps[i]).stacks[0];
        if (prev && curr && (prev.topIndex ?? -1) === 0 && curr.topIndex === 1) {
          stepPushIdx = i;
          break;
        }
      }
      expect(stepPushIdx).toBeGreaterThan(0);

      const prevStep = trace.steps[stepPushIdx - 1];
      const currStep = trace.steps[stepPushIdx];
      const prevStack = recognize(prevStep).stacks[0];
      const currStack = recognize(currStep).stacks[0];

      // Stepping backward across the push
      const backwardPush = computeStackDiff(
        prevStack,
        currStack,
        prevStep.heap,
        currStep.heap,
        { isBackward: true },
      );

      expect(backwardPush.op).toBe('pop');
      expect(backwardPush.poppedSlot).toBe(1);

      // Forward pop
      let stepPopIdx = -1;
      for (let i = 1; i < trace.steps.length; i++) {
        const prev = recognize(trace.steps[i - 1]).stacks[0];
        const curr = recognize(trace.steps[i]).stacks[0];
        if (prev && curr && (prev.topIndex ?? -1) > (curr.topIndex ?? -1)) {
          stepPopIdx = i;
          break;
        }
      }
      const popPrevStep = trace.steps[stepPopIdx - 1];
      const popCurrStep = trace.steps[stepPopIdx];
      const popPrevStack = recognize(popPrevStep).stacks[0];
      const popCurrStack = recognize(popCurrStep).stacks[0];

      // Stepping backward across the pop
      const backwardPop = computeStackDiff(
        popPrevStack,
        popCurrStack,
        popPrevStep.heap,
        popCurrStep.heap,
        { isBackward: true },
      );

      expect(backwardPop.op).toBe('push');
      expect(backwardPop.pushedSlot).toBe(popPrevStack.topIndex);
    });
  });

  // -------------------------------------------------------------------------
  // 2. ResizingStack Diffing & Badge Reversal
  // -------------------------------------------------------------------------
  describe('ResizingStack.json fixture', () => {
    const trace = loadTrace('ResizingStack.json');

    it('detects array resizing capacity 2 → 4, new array ID, and reverses on backward step', () => {
      let resizeStepIdx = -1;
      for (let i = 1; i < trace.steps.length; i++) {
        const prev = recognize(trace.steps[i - 1]).stacks[0];
        const curr = recognize(trace.steps[i]).stacks[0];
        if (
          prev &&
          curr &&
          prev.arrayLength === 2 &&
          curr.arrayLength === 4
        ) {
          resizeStepIdx = i;
          break;
        }
      }

      expect(resizeStepIdx).toBeGreaterThan(0);
      const prevStep = trace.steps[resizeStepIdx - 1];
      const currStep = trace.steps[resizeStepIdx];
      const prevStack = recognize(prevStep).stacks[0];
      const currStack = recognize(currStep).stacks[0];

      // Forward step across resize
      const forwardDiff = computeStackDiff(
        prevStack,
        currStack,
        prevStep.heap,
        currStep.heap,
      );

      expect(forwardDiff.isResized).toBe(true);
      expect(forwardDiff.resizeInfo).toEqual({
        prevCapacity: 2,
        currCapacity: 4,
        direction: 'grow',
      });

      // Backward step across resize
      const backwardDiff = computeStackDiff(
        prevStack,
        currStack,
        prevStep.heap,
        currStep.heap,
        { isBackward: true },
      );

      expect(backwardDiff.isResized).toBe(true);
      expect(backwardDiff.resizeInfo).toEqual({
        prevCapacity: 4,
        currCapacity: 2,
        direction: 'shrink',
      });
    });
  });

  // -------------------------------------------------------------------------
  // 3. CircularQueue Diffing & Wraparound Transitions
  // -------------------------------------------------------------------------
  describe('CircularQueue.json fixture', () => {
    const trace = loadTrace('CircularQueue.json');

    it('detects enqueue, rear marker change, and cell mutation', () => {
      let enqueueStepIdx = -1;
      for (let i = 1; i < trace.steps.length; i++) {
        const prev = recognize(trace.steps[i - 1]).queues[0];
        const curr = recognize(trace.steps[i]).queues[0];
        if (prev && curr && prev.rearIndex === 0 && curr.rearIndex === 1) {
          enqueueStepIdx = i;
          break;
        }
      }

      expect(enqueueStepIdx).toBeGreaterThan(0);
      const prevStep = trace.steps[enqueueStepIdx - 1];
      const currStep = trace.steps[enqueueStepIdx];
      const prevQueue = recognize(prevStep).queues[0];
      const currQueue = recognize(currStep).queues[0];

      const diff = computeQueueDiff(
        prevQueue,
        currQueue,
        prevStep.heap,
        currStep.heap,
      );

      expect(diff.op).toBe('enqueue');
      expect(diff.changedMarkers.has('rear')).toBe(true);

      // In step 20 -> 21, data[rear] = val was written
      const cellStepPrev = trace.steps[enqueueStepIdx - 2];
      const cellStepCurr = trace.steps[enqueueStepIdx - 1];
      const cellDiff = computeQueueDiff(
        recognize(cellStepPrev).queues[0],
        recognize(cellStepCurr).queues[0],
        cellStepPrev.heap,
        cellStepCurr.heap,
      );
      expect(cellDiff.changedSlots.has(0)).toBe(true);
    });

    it('detects dequeue, front marker advance, and stale cell', () => {
      let dequeueStepIdx = -1;
      for (let i = 1; i < trace.steps.length; i++) {
        const prev = recognize(trace.steps[i - 1]).queues[0];
        const curr = recognize(trace.steps[i]).queues[0];
        if (prev && curr && prev.frontIndex === 0 && curr.frontIndex === 1) {
          dequeueStepIdx = i;
          break;
        }
      }

      expect(dequeueStepIdx).toBeGreaterThan(0);
      const prevStep = trace.steps[dequeueStepIdx - 1];
      const currStep = trace.steps[dequeueStepIdx];
      const prevQueue = recognize(prevStep).queues[0];
      const currQueue = recognize(currStep).queues[0];

      const diff = computeQueueDiff(
        prevQueue,
        currQueue,
        prevStep.heap,
        currStep.heap,
      );

      expect(diff.op).toBe('dequeue');
      expect(diff.dequeuedSlot).toBe(0);
      expect(diff.changedMarkers.has('front')).toBe(true);
      expect(diff.staleSlots.has(0)).toBe(true);
    });

    it('detects wrap transition when rear wraps from capacity-1 (3) to 0', () => {
      let wrapStepIdx = -1;
      for (let i = 1; i < trace.steps.length; i++) {
        const prev = recognize(trace.steps[i - 1]).queues[0];
        const curr = recognize(trace.steps[i]).queues[0];
        if (prev && curr && prev.rearIndex === 3 && curr.rearIndex === 0) {
          wrapStepIdx = i;
          break;
        }
      }

      expect(wrapStepIdx).toBeGreaterThan(0);
      const prevStep = trace.steps[wrapStepIdx - 1];
      const currStep = trace.steps[wrapStepIdx];
      const prevQueue = recognize(prevStep).queues[0];
      const currQueue = recognize(currStep).queues[0];

      const diff = computeQueueDiff(
        prevQueue,
        currQueue,
        prevStep.heap,
        currStep.heap,
      );

      expect(diff.isWrapTransition).toBe(true);
      expect(diff.wrappedMarker).toBe('rear');
      expect(diff.changedMarkers.has('rear')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. CircularQueueCount Diffing
  // -------------------------------------------------------------------------
  describe('CircularQueueCount.json fixture', () => {
    const trace = loadTrace('CircularQueueCount.json');

    it('detects count marker and non-structural field changes', () => {
      let countStepIdx = -1;
      for (let i = 1; i < trace.steps.length; i++) {
        const prev = recognize(trace.steps[i - 1]).queues[0];
        const curr = recognize(trace.steps[i]).queues[0];
        if (prev && curr && prev.count !== curr.count && curr.count !== undefined) {
          countStepIdx = i;
          break;
        }
      }

      expect(countStepIdx).toBeGreaterThan(0);
      const prevStep = trace.steps[countStepIdx - 1];
      const currStep = trace.steps[countStepIdx];
      const prevQueue = recognize(prevStep).queues[0];
      const currQueue = recognize(currStep).queues[0];

      const diff = computeQueueDiff(
        prevQueue,
        currQueue,
        prevStep.heap,
        currStep.heap,
      );

      expect(diff.changedMarkers.has('count')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 5. NodeStack Diffing & Ghost Nodes
  // -------------------------------------------------------------------------
  describe('NodeStack.json fixture', () => {
    const trace = loadTrace('NodeStack.json');

    it('detects node push and top marker pointer change', () => {
      let pushIdx = -1;
      for (let i = 1; i < trace.steps.length; i++) {
        const prev = recognize(trace.steps[i - 1]).stacks[0];
        const curr = recognize(trace.steps[i]).stacks[0];
        if (
          prev &&
          curr &&
          (curr.allNodeIds?.length ?? 0) > (prev.allNodeIds?.length ?? 0)
        ) {
          pushIdx = i;
          break;
        }
      }

      expect(pushIdx).toBeGreaterThan(0);
      const prevStep = trace.steps[pushIdx - 1];
      const currStep = trace.steps[pushIdx];
      const prevStack = recognize(prevStep).stacks[0];
      const currStack = recognize(currStep).stacks[0];

      const diff = computeStackDiff(
        prevStack,
        currStack,
        prevStep.heap,
        currStep.heap,
      );

      expect(diff.op).toBe('push');
      expect(diff.addedNodeIds.size).toBe(1);
      expect(diff.changedMarkers.has('top')).toBe(true);
    });

    it('detects node pop and ghost node for removed node', () => {
      let popIdx = -1;
      for (let i = 1; i < trace.steps.length; i++) {
        const prev = recognize(trace.steps[i - 1]).stacks[0];
        const curr = recognize(trace.steps[i]).stacks[0];
        if (
          prev &&
          curr &&
          (curr.allNodeIds?.length ?? 0) < (prev.allNodeIds?.length ?? 0)
        ) {
          popIdx = i;
          break;
        }
      }

      expect(popIdx).toBeGreaterThan(0);
      const prevStep = trace.steps[popIdx - 1];
      const currStep = trace.steps[popIdx];
      const prevStack = recognize(prevStep).stacks[0];
      const currStack = recognize(currStep).stacks[0];

      const diff = computeStackDiff(
        prevStack,
        currStack,
        prevStep.heap,
        currStep.heap,
      );

      expect(diff.op).toBe('pop');
      expect(diff.removedNodeIds.size).toBe(1);
      expect(diff.ghostNodes.length).toBe(1);
      expect(diff.ghostNodes[0].valString).toBe('30');
    });
  });

  // -------------------------------------------------------------------------
  // 6. NodeQueue Diffing
  // -------------------------------------------------------------------------
  describe('NodeQueue.json fixture', () => {
    const trace = loadTrace('NodeQueue.json');

    it('detects node enqueue at rear and dequeue at front with ghost node', () => {
      // Find enqueue
      let enqIdx = -1;
      for (let i = 1; i < trace.steps.length; i++) {
        const prev = recognize(trace.steps[i - 1]).queues[0];
        const curr = recognize(trace.steps[i]).queues[0];
        if (
          prev &&
          curr &&
          (curr.allNodeIds?.length ?? 0) > (prev.allNodeIds?.length ?? 0)
        ) {
          enqIdx = i;
          break;
        }
      }
      expect(enqIdx).toBeGreaterThan(0);

      const enqDiff = computeQueueDiff(
        recognize(trace.steps[enqIdx - 1]).queues[0],
        recognize(trace.steps[enqIdx]).queues[0],
        trace.steps[enqIdx - 1].heap,
        trace.steps[enqIdx].heap,
      );
      expect(enqDiff.op).toBe('enqueue');
      expect(enqDiff.addedNodeIds.size).toBe(1);

      // Find dequeue
      let deqIdx = -1;
      for (let i = 1; i < trace.steps.length; i++) {
        const prev = recognize(trace.steps[i - 1]).queues[0];
        const curr = recognize(trace.steps[i]).queues[0];
        if (
          prev &&
          curr &&
          (curr.allNodeIds?.length ?? 0) < (prev.allNodeIds?.length ?? 0)
        ) {
          deqIdx = i;
          break;
        }
      }
      expect(deqIdx).toBeGreaterThan(0);

      const deqDiff = computeQueueDiff(
        recognize(trace.steps[deqIdx - 1]).queues[0],
        recognize(trace.steps[deqIdx]).queues[0],
        trace.steps[deqIdx - 1].heap,
        trace.steps[deqIdx].heap,
      );
      expect(deqDiff.op).toBe('dequeue');
      expect(deqDiff.removedNodeIds.size).toBe(1);
      expect(deqDiff.ghostNodes.length).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // 7. BracketMatching & PostfixEval Fixtures
  // -------------------------------------------------------------------------
  describe('BracketMatching.json & PostfixEval.json fixtures', () => {
    it('BracketMatching: computes stack pushes and pops for matched brackets', () => {
      const trace = loadTrace('BracketMatching.json');
      let pushCount = 0;
      let popCount = 0;

      for (let i = 1; i < trace.steps.length; i++) {
        const prev = recognize(trace.steps[i - 1]).stacks[0];
        const curr = recognize(trace.steps[i]).stacks[0];
        if (prev && curr) {
          const diff = computeStackDiff(
            prev,
            curr,
            trace.steps[i - 1].heap,
            trace.steps[i].heap,
          );
          if (diff.op === 'push') pushCount++;
          if (diff.op === 'pop') popCount++;
        }
      }

      expect(pushCount).toBeGreaterThan(0);
      expect(popCount).toBeGreaterThan(0);
    });

    it('PostfixEval: computes operand stack push and pop operations', () => {
      const trace = loadTrace('PostfixEval.json');
      let pushCount = 0;
      let popCount = 0;

      for (let i = 1; i < trace.steps.length; i++) {
        const prev = recognize(trace.steps[i - 1]).stacks[0];
        const curr = recognize(trace.steps[i]).stacks[0];
        if (prev && curr) {
          const diff = computeStackDiff(
            prev,
            curr,
            trace.steps[i - 1].heap,
            trace.steps[i].heap,
          );
          if (diff.op === 'push') pushCount++;
          if (diff.op === 'pop') popCount++;
        }
      }

      expect(pushCount).toBeGreaterThan(0);
      expect(popCount).toBeGreaterThan(0);
    });
  });

  // -------------------------------------------------------------------------
  // 8. Performance Benchmark: 30-slot Stack & Queue (< 5 ms per step)
  // -------------------------------------------------------------------------
  describe('Performance Benchmark (Requirement 10)', () => {
    it('measures diff calculation for a 30-slot stack and queue across 100 iterations (well under 5ms)', () => {
      // Build 30-slot stack snapshots
      const stackA = {
        kind: 'stack' as const,
        backing: 'array' as const,
        confidence: 'high' as const,
        reasons: [],
        id: '@stack',
        arrayId: '@arr',
        arrayLength: 30,
        topIndex: 15,
        occupiedSlots: Array.from({ length: 16 }, (_, i) => i),
        freeSlots: Array.from({ length: 14 }, (_, i) => i + 16),
        isEmpty: false,
        isFull: false,
        isResized: false,
        entryPoints: [],
      };

      const stackB = {
        ...stackA,
        topIndex: 16,
        occupiedSlots: Array.from({ length: 17 }, (_, i) => i),
        freeSlots: Array.from({ length: 13 }, (_, i) => i + 17),
      };

      const heapA = {
        '@arr': {
          kind: 'array' as const,
          elemType: 'int',
          length: 30,
          clipped: false,
          items: Array.from({ length: 30 }, (_, i) => ({
            k: 'prim' as const,
            v: i < 16 ? i * 10 : 0,
          })),
        },
      };

      const heapB = {
        '@arr': {
          kind: 'array' as const,
          elemType: 'int',
          length: 30,
          clipped: false,
          items: Array.from({ length: 30 }, (_, i) => ({
            k: 'prim' as const,
            v: i < 17 ? i * 10 : 0,
          })),
        },
      };

      const queueA = {
        kind: 'queue' as const,
        backing: 'array' as const,
        variant: 'circularGap' as const,
        confidence: 'high' as const,
        reasons: [],
        id: '@queue',
        arrayId: '@arrQ',
        arrayLength: 30,
        frontIndex: 5,
        rearIndex: 25,
        occupiedSlots: Array.from({ length: 20 }, (_, i) => i + 5),
        freeSlots: [0, 1, 2, 3, 4, 25, 26, 27, 28, 29],
        isEmpty: false,
        isFull: false,
        hasWrapped: false,
        isResized: false,
        entryPoints: [],
      };

      const queueB = {
        ...queueA,
        rearIndex: 26,
        occupiedSlots: Array.from({ length: 21 }, (_, i) => i + 5),
      };

      const heapQA = {
        '@arrQ': {
          kind: 'array' as const,
          elemType: 'int',
          length: 30,
          clipped: false,
          items: Array.from({ length: 30 }, (_, i) => ({
            k: 'prim' as const,
            v: i * 5,
          })),
        },
      };

      const heapQB = {
        '@arrQ': {
          kind: 'array' as const,
          elemType: 'int',
          length: 30,
          clipped: false,
          items: Array.from({ length: 30 }, (_, i) => ({
            k: 'prim' as const,
            v: i * 5,
          })),
        },
      };

      const iterations = 100;
      const start = performance.now();
      for (let i = 0; i < iterations; i++) {
        computeStackDiff(stackA, stackB, heapA, heapB);
        computeQueueDiff(queueA, queueB, heapQA, heapQB);
      }
      const totalTime = performance.now() - start;
      const avgTimePerStep = totalTime / (iterations * 2);

      console.log(
        `30-slot Stack & Queue Diff Benchmark: ${avgTimePerStep.toFixed(4)} ms per step (${iterations * 2} ops in ${totalTime.toFixed(2)} ms)`,
      );

      // Must be well under 5ms (typically < 0.05ms)
      expect(avgTimePerStep).toBeLessThan(5.0);
    });
  });

  // -------------------------------------------------------------------------
  // 9. Animation Duration & Reduced Motion Scaling
  // -------------------------------------------------------------------------
  describe('Animation Duration Scaling', () => {
    it('scales durations based on speed, playing state, and prefers-reduced-motion', () => {
      // Reduced motion must return 0
      expect(getAnimationDuration(1, false, true)).toBe(0);
      expect(getAnimationDuration(4, true, true)).toBe(0);

      // Manual stepping returns standard 0.28s
      expect(getAnimationDuration(1, false, false)).toBe(0.28);
      expect(getAnimationDuration(4, false, false)).toBe(0.28);

      // Playing at 1x
      expect(getAnimationDuration(1, true, false)).toBe(0.28);

      // Playing at 2x
      expect(getAnimationDuration(2, true, false)).toBe(0.12);

      // Playing at 4x (snappy 50ms, no queueing)
      expect(getAnimationDuration(4, true, false)).toBe(0.05);
    });
  });
});
