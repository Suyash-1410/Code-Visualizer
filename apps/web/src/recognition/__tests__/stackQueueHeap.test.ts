import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  heapParent,
  heapLeft,
  heapRight,
  heapLevel,
  getHeapEdges,
  extractNumeric,
  checkHeapProperty,
  findHeapViolations,
} from '../heapMath';
import {
  buildTraceContext,
  findArrayBackedCandidates,
  scoreArrayCandidate,
  computeStackRoles,
  computeQueueRoles,
} from '../stackQueueHeap';
import { recognize } from '../linkedList';
import type {
  HeapObject,
  StackFrame,
  Step,
  Trace,
} from '../../trace/types';
import type { StructureOverride } from '../types';

const fixturesDir = path.resolve(
  __dirname,
  '../../../../../tests/fixtures/traces',
);

function loadFixture(filename: string): Trace {
  const filePath = path.join(fixturesDir, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

describe('Stack, Queue, and Heap Recognition Suite (Phase 4 Stage 2)', () => {
  // -------------------------------------------------------------------------
  // 1. Pure Heap Math & Invariant Functions
  // -------------------------------------------------------------------------
  describe('Pure Heap Tree Math & Invariant Checks', () => {
    it('computes correct parent, left, right, and level for complete binary tree', () => {
      // Root (0)
      expect(heapParent(0)).toBe(-1);
      expect(heapLeft(0)).toBe(1);
      expect(heapRight(0)).toBe(2);
      expect(heapLevel(0)).toBe(0);

      // Level 1: left (1) and right (2)
      expect(heapParent(1)).toBe(0);
      expect(heapParent(2)).toBe(0);
      expect(heapLeft(1)).toBe(3);
      expect(heapRight(1)).toBe(4);
      expect(heapLeft(2)).toBe(5);
      expect(heapRight(2)).toBe(6);
      expect(heapLevel(1)).toBe(1);
      expect(heapLevel(2)).toBe(1);

      // Level 2: nodes 3..6
      expect(heapParent(3)).toBe(1);
      expect(heapParent(4)).toBe(1);
      expect(heapParent(5)).toBe(2);
      expect(heapParent(6)).toBe(2);
      expect(heapLevel(3)).toBe(2);
      expect(heapLevel(6)).toBe(2);

      // Level 3: node 7
      expect(heapLevel(7)).toBe(3);
      expect(heapParent(7)).toBe(3);
    });

    it('generates complete binary tree edges for elements in [0, size)', () => {
      expect(getHeapEdges(0)).toEqual([]);
      expect(getHeapEdges(1)).toEqual([]);

      const edges3 = getHeapEdges(3);
      expect(edges3).toEqual([
        { parent: 0, child: 1, isLeft: true },
        { parent: 0, child: 2, isLeft: false },
      ]);

      const edges5 = getHeapEdges(5);
      expect(edges5).toHaveLength(4);
      expect(edges5).toEqual([
        { parent: 0, child: 1, isLeft: true },
        { parent: 0, child: 2, isLeft: false },
        { parent: 1, child: 3, isLeft: true },
        { parent: 1, child: 4, isLeft: false },
      ]);
    });

    it('extracts numeric values safely from primitives and numbers', () => {
      expect(extractNumeric(42)).toBe(42);
      expect(extractNumeric({ k: 'prim', t: 'int', v: 99 })).toBe(99);
      expect(extractNumeric(null)).toBeNull();
      expect(extractNumeric(undefined)).toBeNull();
      expect(extractNumeric({ k: 'ref', id: '@1' })).toBeNull();
    });

    it('validates min-heap and max-heap properties', () => {
      const validMin = [10, 20, 30, 40, 50];
      const validMax = [50, 40, 30, 20, 10];
      const brokenMin = [10, 50, 30, 20, 60]; // 20 is child of 50, but 20 < 50

      expect(checkHeapProperty(validMin, 5, 'minHeap')).toBe(true);
      expect(checkHeapProperty(validMin, 5, 'maxHeap')).toBe(false);

      expect(checkHeapProperty(validMax, 5, 'maxHeap')).toBe(true);
      expect(checkHeapProperty(validMax, 5, 'minHeap')).toBe(false);

      expect(checkHeapProperty(brokenMin, 5, 'minHeap')).toBe(false);
    });

    it('finds invariant violations and formats descriptive messages', () => {
      const invalidMin = [100, 20, 30]; // 100 > 20 and 100 > 30
      const violations = findHeapViolations(invalidMin, 3, 'minHeap');

      expect(violations).toHaveLength(2);
      expect(violations[0]).toEqual({
        parentIndex: 0,
        childIndex: 1,
        parentValue: 100,
        childValue: 20,
        message: 'Min-heap violation: parent at [0] (100) > child at [1] (20)',
      });
      expect(violations[1]).toEqual({
        parentIndex: 0,
        childIndex: 2,
        parentValue: 100,
        childValue: 30,
        message: 'Min-heap violation: parent at [0] (100) > child at [2] (30)',
      });
    });
  });

  // -------------------------------------------------------------------------
  // 2. Candidate Detection & Scoring (Hand-Crafted Snapshots)
  // -------------------------------------------------------------------------
  describe('Candidate Detection and Confidence Scoring', () => {
    it('detects array-backed wrapper class with array and top field as stack', () => {
      const heap: Record<string, HeapObject> = {
        '@arr': {
          kind: 'array',
          elemType: 'int',
          length: 5,
          items: [{ k: 'prim', t: 'int', v: 10 }],
          clipped: false,
        },
        '@stack': {
          kind: 'object',
          type: 'ArrayStack',
          fields: {
            data: { k: 'ref', id: '@arr' },
            top: { k: 'prim', t: 'int', v: 0 },
          },
        },
      };

      const candidates = findArrayBackedCandidates(heap);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].isWrapper).toBe(true);
      expect(candidates[0].topValue).toBe(0);

      const scored = scoreArrayCandidate(candidates[0], new Set(['push', 'pop']));
      expect(scored.bestKind).toBe('stack');
      expect(scored.confidence).toBe('high');
      expect(scored.reasons.length).toBeGreaterThan(0);
      expect(scored.reasons.some((r) => r.includes('Stack'))).toBe(true);
    });

    it('detects local-variable trio in stack frame with medium confidence', () => {
      const heap: Record<string, HeapObject> = {
        '@arr': {
          kind: 'array',
          elemType: 'int',
          length: 10,
          items: [],
          clipped: false,
        },
      };

      const stack: StackFrame[] = [
        {
          frameId: 1,
          method: 'Main.main',
          signature: 'void main(String[])',
          line: 5,
          locals: [
            { name: 'stack', type: 'int[]', value: { k: 'ref', id: '@arr' } },
            { name: 'top', type: 'int', value: { k: 'prim', t: 'int', v: -1 } },
          ],
        },
      ];

      const candidates = findArrayBackedCandidates(heap, stack);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].isWrapper).toBe(false);
      expect(candidates[0].topValue).toBe(-1);

      const scored = scoreArrayCandidate(candidates[0], new Set());
      expect(scored.bestKind).toBe('stack');
      // Local trio capped at medium confidence per PRD clarification (a)
      expect(scored.confidence).toBe('medium');
    });

    it('penalizes dynamic list (ArrayListLike) so it stays plain array', () => {
      const heap: Record<string, HeapObject> = {
        '@arr': {
          kind: 'array',
          elemType: 'int',
          length: 4,
          items: [{ k: 'prim', t: 'int', v: 10 }],
          clipped: false,
        },
        '@list': {
          kind: 'object',
          type: 'ArrayListLike',
          fields: {
            data: { k: 'ref', id: '@arr' },
            size: { k: 'prim', t: 'int', v: 1 },
          },
        },
      };

      const candidates = findArrayBackedCandidates(heap);
      expect(candidates).toHaveLength(1);
      const scored = scoreArrayCandidate(candidates[0], new Set(['add', 'get']));
      expect(scored.bestKind).toBe('array');
    });

    it('excludes JDK standard collections from wrapper candidates', () => {
      const heap: Record<string, HeapObject> = {
        '@arr': {
          kind: 'array',
          elemType: 'Object',
          length: 10,
          items: [],
          clipped: false,
        },
        '@jdkStack': {
          kind: 'object',
          type: 'java.util.Stack',
          fields: {
            elementData: { k: 'ref', id: '@arr' },
            elementCount: { k: 'prim', t: 'int', v: 0 },
          },
        },
      };

      const candidates = findArrayBackedCandidates(heap);
      expect(candidates).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Semantic Roles Computation
  // -------------------------------------------------------------------------
  describe('Semantic Roles Computation', () => {
    it('computes stack empty, full, occupied, and free slot ranges', () => {
      const dummyArr = {
        kind: 'array' as const,
        elemType: 'int',
        length: 5,
        items: [],
        clipped: false,
      };

      // Empty stack
      const emptyRoles = computeStackRoles({
        id: '@1',
        isWrapper: true,
        arrayId: '@arr1',
        arrayObj: dummyArr,
        entryPoints: [],
        topValue: -1,
      });
      expect(emptyRoles.isEmpty).toBe(true);
      expect(emptyRoles.isFull).toBe(false);
      expect(emptyRoles.occupiedSlots).toEqual([]);
      expect(emptyRoles.freeSlots).toEqual([0, 1, 2, 3, 4]);

      // Partially full stack (top = 2)
      const partRoles = computeStackRoles({
        id: '@1',
        isWrapper: true,
        arrayId: '@arr1',
        arrayObj: dummyArr,
        entryPoints: [],
        topValue: 2,
      });
      expect(partRoles.isEmpty).toBe(false);
      expect(partRoles.isFull).toBe(false);
      expect(partRoles.occupiedSlots).toEqual([0, 1, 2]);
      expect(partRoles.freeSlots).toEqual([3, 4]);

      // Full stack (top = 4)
      const fullRoles = computeStackRoles({
        id: '@1',
        isWrapper: true,
        arrayId: '@arr1',
        arrayObj: dummyArr,
        entryPoints: [],
        topValue: 4,
      });
      expect(fullRoles.isEmpty).toBe(false);
      expect(fullRoles.isFull).toBe(true);
      expect(fullRoles.occupiedSlots).toEqual([0, 1, 2, 3, 4]);
      expect(fullRoles.freeSlots).toEqual([]);
    });

    it('computes linear queue roles with monotonic front and rear', () => {
      const dummyArr = {
        kind: 'array' as const,
        elemType: 'int',
        length: 5,
        items: [],
        clipped: false,
      };

      const roles = computeQueueRoles({
        id: '@1',
        isWrapper: true,
        arrayId: '@arr',
        arrayObj: dummyArr,
        entryPoints: [],
        frontValue: 1,
        rearValue: 4,
      });

      expect(roles.variant).toBe('linear');
      expect(roles.frontIndex).toBe(1);
      expect(roles.rearIndex).toBe(4);
      expect(roles.occupiedSlots).toEqual([1, 2, 3]);
      expect(roles.freeSlots).toEqual([0, 4]);
      expect(roles.hasWrapped).toBe(false);
    });

    it('computes circular queue (gap-slot variant) with wraparound', () => {
      const dummyArr = {
        kind: 'array' as const,
        elemType: 'int',
        length: 4,
        items: [],
        clipped: false,
      };

      // rear < front -> wrapped around: front = 2, rear = 1
      const roles = computeQueueRoles({
        id: '@1',
        className: 'CircularQueue',
        isWrapper: true,
        arrayId: '@arr',
        arrayObj: dummyArr,
        entryPoints: [],
        frontValue: 2,
        rearValue: 1,
      });

      expect(roles.variant).toBe('circularGap');
      expect(roles.hasWrapped).toBe(true);
      expect(roles.occupiedSlots).toEqual([2, 3, 0]);
      expect(roles.freeSlots).toEqual([1]);
      expect(roles.isFull).toBe(true); // (rear + 1) % 4 == front -> (1 + 1) % 4 == 2
    });

    it('computes circular queue (count-based variant)', () => {
      const dummyArr = {
        kind: 'array' as const,
        elemType: 'int',
        length: 4,
        items: [],
        clipped: false,
      };

      const roles = computeQueueRoles({
        id: '@1',
        isWrapper: true,
        arrayId: '@arr',
        arrayObj: dummyArr,
        entryPoints: [],
        frontValue: 3,
        rearValue: 1,
        countValue: 2,
      });

      expect(roles.variant).toBe('circularCount');
      expect(roles.occupiedSlots).toEqual([3, 0]);
      expect(roles.freeSlots).toEqual([1, 2]);
      expect(roles.hasWrapped).toBe(true);
      expect(roles.isEmpty).toBe(false);
      expect(roles.isFull).toBe(false);
    });

    it('detects array resizing when backing array ID changes', () => {
      const dummyArr = {
        kind: 'array' as const,
        elemType: 'int',
        length: 4,
        items: [],
        clipped: false,
      };

      const c = {
        id: '@stack',
        isWrapper: true,
        arrayId: '@newArr',
        arrayObj: dummyArr,
        entryPoints: [],
        topValue: 2,
      };

      const rolesSame = computeStackRoles(c, '@newArr');
      expect(rolesSame.isResized).toBe(false);

      const rolesResized = computeStackRoles(c, '@oldArr');
      expect(rolesResized.isResized).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Trace Context & Step Flicker-Free Stability (DEC-024)
  // -------------------------------------------------------------------------
  describe('TraceContext Method Aggregation', () => {
    it('aggregates all method names across trace steps', () => {
      const steps: Step[] = [
        {
          i: 0,
          event: 'call',
          line: 1,
          stack: [{ frameId: 1, method: 'MinHeap.main', signature: '()', line: 1, locals: [] }],
          heap: {},
          statics: [],
          returnValue: null,
          stdoutLen: 0,
          clipped: false,
        },
        {
          i: 1,
          event: 'call',
          line: 2,
          stack: [
            { frameId: 1, method: 'MinHeap.main', signature: '()', line: 1, locals: [] },
            { frameId: 2, method: 'MinHeap.siftUp', signature: '(int)', line: 10, locals: [] },
          ],
          heap: {},
          statics: [],
          returnValue: null,
          stdoutLen: 0,
          clipped: false,
        },
      ];

      const ctx = buildTraceContext(steps);
      expect(ctx.allMethodNames?.has('main')).toBe(true);
      expect(ctx.allMethodNames?.has('siftup')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Real Golden Trace Fixtures (tests/fixtures/traces/*.json)
  // -------------------------------------------------------------------------
  describe('Real Fixture Tests (tests/fixtures/traces)', () => {
    // --- STACKS ---
    it('ArrayStack: recognizes user-written stack class with data and top (ArrayStack)', () => {
      const trace = loadFixture('ArrayStack.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.stacks).toHaveLength(1);
      const s = res.stacks[0];
      expect(s.backing).toBe('array');
      expect(s.confidence).toBe('high');
      expect(s.topIndex).toBeGreaterThanOrEqual(0);
      expect(s.occupiedSlots.length).toBe(s.topIndex! + 1);
      expect(s.reasons.some((r) => r.includes('Stack'))).toBe(true);
      // Backing array absorbed, only String[] args remains in res.arrays
      expect(res.arrays.some((a) => a.id === s.arrayId)).toBe(false);
    });

    it('ArrayStackLocals: recognizes local variable stack in main (ArrayStackLocals)', () => {
      const trace = loadFixture('ArrayStackLocals.json');
      const traceCtx = buildTraceContext(trace.steps);
      // Pick a step after elements are pushed
      const step = trace.steps.find((st) =>
        st.stack?.[0]?.locals.some(
          (l) => l.name === 'top' && l.value.k === 'prim' && typeof l.value.v === 'number' && l.value.v >= 0,
        ),
      )!;
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.stacks).toHaveLength(1);
      const s = res.stacks[0];
      expect(s.backing).toBe('array');
      expect(s.confidence).toBe('medium');
      expect(s.topFieldOrLocal).toBe('top');
      expect(res.arrays.some((a) => a.id === s.arrayId)).toBe(false);
    });

    it('NodeStack: recognizes linked stack with top pointer (NodeStack)', () => {
      const trace = loadFixture('NodeStack.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.stacks).toHaveLength(1);
      const s = res.stacks[0];
      expect(s.backing).toBe('node');
      expect(s.confidence).toBe('high');
      expect(s.topNodeId).toBeTruthy();
      expect(res.structures).toHaveLength(0); // Node stack beats plain linked list!
    });

    it('ResizingStack: detects array reallocation between steps (ResizingStack)', () => {
      const trace = loadFixture('ResizingStack.json');
      const traceCtx = buildTraceContext(trace.steps);

      // Find step where resize occurred (array id changed under stack wrapper)
      let detectedResize = false;
      for (let i = 1; i < trace.steps.length; i++) {
        const curStep = trace.steps[i];
        const prevStep = trace.steps[i - 1];
        const res = recognize(curStep, undefined, undefined, prevStep, traceCtx);
        if (res.stacks.length > 0 && res.stacks[0].isResized) {
          detectedResize = true;
          expect(res.stacks[0].arrayLength).toBe(4); // Resized from 2 to 4
          break;
        }
      }
      expect(detectedResize).toBe(true);
    });

    it('StackOverflow: tracks stack until isFull before exception (StackOverflow)', () => {
      const trace = loadFixture('StackOverflow.json');
      const traceCtx = buildTraceContext(trace.steps);
      // Find step where top == 1 (capacity 2)
      const fullStep = trace.steps.find((st) => {
        const res = recognize(st, undefined, undefined, undefined, traceCtx);
        return res.stacks.length > 0 && res.stacks[0].isFull;
      });
      expect(fullStep).toBeDefined();
    });

    it('StackUnderflow: handles empty stack state (StackUnderflow)', () => {
      const trace = loadFixture('StackUnderflow.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps.find((st) =>
        st.stack?.[0]?.locals.some((l) => l.name === 's' && l.value.k === 'ref'),
      )!;
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.stacks).toHaveLength(1);
      expect(res.stacks[0].isEmpty).toBe(true);
    });

    it('BracketMatching: recognizes char-array stack (BracketMatching)', () => {
      const trace = loadFixture('BracketMatching.json');
      const traceCtx = buildTraceContext(trace.steps);
      // Find a step with pushed chars
      const step = trace.steps.find((st) => {
        const res = recognize(st, undefined, undefined, undefined, traceCtx);
        return res.stacks.length > 0 && res.stacks[0].occupiedSlots.length > 0;
      });
      expect(step).toBeDefined();
    });

    it('PostfixEval: recognizes int stack in evaluation (PostfixEval)', () => {
      const trace = loadFixture('PostfixEval.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps.find((st) => {
        const res = recognize(st, undefined, undefined, undefined, traceCtx);
        return res.stacks.length > 0 && res.stacks[0].topIndex! >= 1;
      });
      expect(step).toBeDefined();
    });

    // --- QUEUES ---
    it('ArrayQueueLinear: recognizes linear queue with front and rear (ArrayQueueLinear)', () => {
      const trace = loadFixture('ArrayQueueLinear.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.queues).toHaveLength(1);
      const q = res.queues[0];
      expect(q.backing).toBe('array');
      expect(q.variant).toBe('linear');
      expect(q.confidence).toBe('high');
      expect(q.occupiedSlots.length).toBeGreaterThan(0);
    });

    it('CircularQueue: recognizes circular gap-slot queue and wraparound (CircularQueue)', () => {
      const trace = loadFixture('CircularQueue.json');
      const traceCtx = buildTraceContext(trace.steps);

      // Find empty step where q is initialized in main
      const emptyStep = trace.steps.find((st) =>
        st.stack?.[0]?.locals.some((l) => l.name === 'q' && l.value.k === 'ref'),
      )!;
      const emptyRes = recognize(emptyStep, undefined, undefined, undefined, traceCtx);
      expect(emptyRes.queues).toHaveLength(1);
      expect(emptyRes.queues[0].isEmpty).toBe(true);

      // Find wrapped step
      const wrappedStep = trace.steps.find((st) => {
        const res = recognize(st, undefined, undefined, undefined, traceCtx);
        return res.queues.length > 0 && res.queues[0].hasWrapped;
      });
      expect(wrappedStep).toBeDefined();
    });

    it('CircularQueueCount: recognizes count-based circular queue (CircularQueueCount)', () => {
      const trace = loadFixture('CircularQueueCount.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps.find((st) => {
        const res = recognize(st, undefined, undefined, undefined, traceCtx);
        return res.queues.length > 0 && res.queues[0].count === 3 && res.queues[0].isFull;
      });
      expect(step).toBeDefined();
      const res = recognize(step!, undefined, undefined, undefined, traceCtx);
      expect(res.queues[0].variant).toBe('circularCount');
      expect(res.queues[0].isFull).toBe(true);
    });

    it('NodeQueue: recognizes node-backed queue with front and rear pointers (NodeQueue)', () => {
      const trace = loadFixture('NodeQueue.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.queues).toHaveLength(1);
      const q = res.queues[0];
      expect(q.backing).toBe('node');
      expect(q.variant).toBe('node');
      expect(q.confidence).toBe('high');
      expect(res.structures).toHaveLength(0); // Absorbed
    });

    it('QueueFromTwoStacks: recognizes two stack structures alive concurrently (QueueFromTwoStacks)', () => {
      const trace = loadFixture('QueueFromTwoStacks.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.stacks).toHaveLength(2);
      expect(res.stacks[0].backing).toBe('array');
      expect(res.stacks[1].backing).toBe('array');
    });

    // --- HEAPS ---
    it('MinHeapInsert: recognizes min-heap with size, sift-up, and tree edges (MinHeapInsert)', () => {
      const trace = loadFixture('MinHeapInsert.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.heaps).toHaveLength(1);
      const h = res.heaps[0];
      expect(h.heapType).toBe('minHeap');
      expect(h.confidence).toBe('high');
      expect(h.size).toBe(5);
      expect(h.edges.length).toBe(4);
      expect(h.violations).toHaveLength(0);
    });

    it('MinHeapExtract: recognizes min-heap during extract operations (MinHeapExtract)', () => {
      const trace = loadFixture('MinHeapExtract.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps[10];
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.heaps).toHaveLength(1);
      expect(res.heaps[0].heapType).toBe('minHeap');
    });

    it('MaxHeap: recognizes max-heap with extractMax and sift-down (MaxHeap)', () => {
      const trace = loadFixture('MaxHeap.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.heaps).toHaveLength(1);
      const h = res.heaps[0];
      expect(h.heapType).toBe('maxHeap');
      expect(h.confidence).toBe('high');
      expect(h.violations).toHaveLength(0);
    });

    it('BuildHeapHeapify: recognizes heap building on bare array with sift-down (BuildHeapHeapify)', () => {
      const trace = loadFixture('BuildHeapHeapify.json');
      const traceCtx = buildTraceContext(trace.steps);
      // In siftDown frame, array 'a' and 'n' are tracked
      const step = trace.steps.find((st) =>
        st.stack?.some((f) => f.method.includes('siftDown')),
      )!;
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.heaps.length).toBeGreaterThanOrEqual(1);
      expect(res.heaps[0].heapType).toBe('minHeap');
    });

    it('HeapSortBareArray: supports View as Heap on bare array (HeapSortBareArray)', () => {
      const trace = loadFixture('HeapSortBareArray.json');
      const finalStep = trace.steps[trace.steps.length - 2];

      // In main with arr, user forces View as Heap on arr (elemType: int)
      const arrId = Object.keys(finalStep.heap).find((k) => k !== '@670')!;
      const overrides = new Map<string, StructureOverride>();
      overrides.set(arrId, 'maxHeap');

      const res = recognize(finalStep, undefined, overrides);
      expect(res.heaps).toHaveLength(1);
      expect(res.heaps[0].heapType).toBe('maxHeap');
      expect(res.heaps[0].size).toBe(5);
    });

    it('HeapInlineSwap: recognizes heap with inline swap logic (HeapInlineSwap)', () => {
      const trace = loadFixture('HeapInlineSwap.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.heaps).toHaveLength(1);
      expect(res.heaps[0].size).toBe(3);
    });

    it('HeapWithEqualValues: handles duplicates without false violations (HeapWithEqualValues)', () => {
      const trace = loadFixture('HeapWithEqualValues.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.heaps).toHaveLength(1);
      expect(res.heaps[0].size).toBe(5);
      expect(res.heaps[0].violations).toHaveLength(0);
    });

    it('HeapOffByOne: detects and flags heap invariant violation (HeapOffByOne)', () => {
      const trace = loadFixture('HeapOffByOne.json');
      const traceCtx = buildTraceContext(trace.steps);
      // Final step where buggy sift-down failed to fix [50, 10, 20]
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.heaps).toHaveLength(1);
      const h = res.heaps[0];
      expect(h.violations.length).toBeGreaterThan(0);
      expect(h.violations[0].parentValue).toBe(50);
      expect(h.violations[0].childValue).toBe(10);
    });

    it('NamedHeapNotHeap: flags corruption on named MinHeap class (NamedHeapNotHeap)', () => {
      const trace = loadFixture('NamedHeapNotHeap.json');
      const traceCtx = buildTraceContext(trace.steps);
      const finalStep = trace.steps[trace.steps.length - 2];
      const res = recognize(finalStep, undefined, undefined, undefined, traceCtx);

      expect(res.heaps).toHaveLength(1);
      expect(res.heaps[0].violations.length).toBeGreaterThan(0);
    });

    it('HeapFull31: handles 31-element heap and computes all 30 tree edges (HeapFull31)', () => {
      const trace = loadFixture('HeapFull31.json');
      const traceCtx = buildTraceContext(trace.steps);
      const finalStep = trace.steps[trace.steps.length - 2];
      const res = recognize(finalStep, undefined, undefined, undefined, traceCtx);

      expect(res.heaps).toHaveLength(1);
      const h = res.heaps[0];
      expect(h.size).toBe(31);
      expect(h.isFull).toBe(true);
      expect(h.edges).toHaveLength(30);
    });

    // --- NEGATIVES & AMBIGUITY ---
    it('ArrayListLike: stays plain array and is NOT classified as stack/queue/heap (ArrayListLike)', () => {
      const trace = loadFixture('ArrayListLike.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.stacks).toHaveLength(0);
      expect(res.queues).toHaveLength(0);
      expect(res.heaps).toHaveLength(0);
      expect(res.arrays.length).toBeGreaterThanOrEqual(1);
    });

    it('ArrayAndCounter: unrelated count local stays plain array (ArrayAndCounter)', () => {
      const trace = loadFixture('ArrayAndCounter.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.stacks).toHaveLength(0);
      expect(res.queues).toHaveLength(0);
      expect(res.heaps).toHaveLength(0);
      expect(res.arrays.length).toBe(2); // String[] args + int[] arr
    });

    it('TwoStructuresAtOnce: simultaneously recognizes Stack, Queue, and Heap (TwoStructuresAtOnce)', () => {
      const trace = loadFixture('TwoStructuresAtOnce.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.stacks).toHaveLength(1);
      expect(res.queues).toHaveLength(1);
      expect(res.heaps).toHaveLength(1);
      const absorbedIds = [res.stacks[0].arrayId, res.queues[0].arrayId, res.heaps[0].arrayId];
      expect(res.arrays.every((a) => !absorbedIds.includes(a.id))).toBe(true);
    });

    it('JdkCollectionsMix: java.util.Stack, ArrayDeque, and PriorityQueue stay opaque (JdkCollectionsMix)', () => {
      const trace = loadFixture('JdkCollectionsMix.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.stacks).toHaveLength(0);
      expect(res.queues).toHaveLength(0);
      expect(res.heaps).toHaveLength(0);
    });

    it('EmptyStructures: correctly identifies created but unfilled structures as empty (EmptyStructures)', () => {
      const trace = loadFixture('EmptyStructures.json');
      const traceCtx = buildTraceContext(trace.steps);
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step, undefined, undefined, undefined, traceCtx);

      expect(res.stacks).toHaveLength(1);
      expect(res.stacks[0].isEmpty).toBe(true);

      expect(res.queues).toHaveLength(1);
      expect(res.queues[0].isEmpty).toBe(true);

      expect(res.heaps).toHaveLength(1);
      expect(res.heaps[0].isEmpty).toBe(true);
    });

    // --- VIEW AS OVERRIDES ---
    it('View As override forces Stack to plain Array', () => {
      const trace = loadFixture('ArrayStack.json');
      const step = trace.steps[trace.steps.length - 2];

      const overrides = new Map<string, StructureOverride>();
      const stackObjId = Object.keys(step.heap).find((k) => step.heap[k].kind === 'object')!;
      overrides.set(stackObjId, 'array');

      const res = recognize(step, undefined, overrides);
      expect(res.stacks).toHaveLength(0);
      expect(res.arrays.length).toBeGreaterThanOrEqual(1);
    });

    it('View As override forces Queue to generic Object', () => {
      const trace = loadFixture('CircularQueue.json');
      const step = trace.steps[trace.steps.length - 2];

      const overrides = new Map<string, StructureOverride>();
      const queueObjId = Object.keys(step.heap).find((k) => step.heap[k].kind === 'object')!;
      overrides.set(queueObjId, 'object');

      const res = recognize(step, undefined, overrides);
      expect(res.queues).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Performance Benchmark (<10ms for 100-object snapshot)
  // -------------------------------------------------------------------------
  describe('Performance Benchmark', () => {
    it('recognizes 100-object heap snapshot in well under 10 ms', () => {
      const heap: Record<string, HeapObject> = {};

      // 50 stacks and 50 heaps
      for (let i = 1; i <= 50; i++) {
        heap[`@arr_s_${i}`] = {
          kind: 'array',
          elemType: 'int',
          length: 10,
          items: [{ k: 'prim', t: 'int', v: i }],
          clipped: false,
        };
        heap[`@stack_${i}`] = {
          kind: 'object',
          type: 'ArrayStack',
          fields: {
            data: { k: 'ref', id: `@arr_s_${i}` },
            top: { k: 'prim', t: 'int', v: 0 },
          },
        };

        heap[`@arr_h_${i}`] = {
          kind: 'array',
          elemType: 'int',
          length: 10,
          items: [{ k: 'prim', t: 'int', v: i }],
          clipped: false,
        };
        heap[`@heap_${i}`] = {
          kind: 'object',
          type: 'MinHeap',
          fields: {
            heap: { k: 'ref', id: `@arr_h_${i}` },
            size: { k: 'prim', t: 'int', v: 1 },
          },
        };
      }

      const step: Step = {
        i: 1,
        event: 'line',
        line: 1,
        stack: [
          {
            frameId: 1,
            method: 'Benchmark.main',
            signature: 'void main(String[])',
            line: 1,
            locals: [],
          },
        ],
        heap,
        statics: [],
        returnValue: null,
        stdoutLen: 0,
        clipped: false,
      };

      const t0 = performance.now();
      const res = recognize(step);
      const durationMs = performance.now() - t0;

      expect(res.stacks).toHaveLength(50);
      expect(res.heaps).toHaveLength(50);
      expect(durationMs).toBeLessThan(10); // PRD: well under 10 ms
      console.log(`Recognize 100-object heap benchmark: ${durationMs.toFixed(3)} ms`);
    });
  });
});
