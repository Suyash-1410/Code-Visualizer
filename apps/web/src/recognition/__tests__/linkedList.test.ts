import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  analyzeClassShapes,
  buildChainsForComponent,
  checkDoublyLinkStatus,
  collectEntryPoints,
  computeGhosts,
  recognize,
} from '../linkedList';
import type {
  HeapObject,
  Step,
  Trace,
} from '../../trace/types';

const fixturesDir = path.resolve(
  __dirname,
  '../../../../../tests/fixtures/traces',
);

function loadFixture(filename: string): Trace {
  const filePath = path.join(fixturesDir, filename);
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

// ---------------------------------------------------------------------------
// Unit tests for pure recognition functions & algorithms
// ---------------------------------------------------------------------------

describe('Linked List Recognition Suite (Phase 2)', () => {
  describe('Class-Shape Analysis', () => {
    it('identifies singly linked list with single self-referencing next field', () => {
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'Node',
          fields: {
            val: { k: 'prim', t: 'int', v: 10 },
            next: { k: 'ref', id: '@2' },
          },
        },
        '@2': {
          kind: 'object',
          type: 'Node',
          fields: {
            val: { k: 'prim', t: 'int', v: 20 },
            next: { k: 'null' },
          },
        },
      };

      const shapes = analyzeClassShapes(heap);
      const shape = shapes.get('Node');
      expect(shape).toBeDefined();
      expect(shape?.kind).toBe('linkedList');
      expect(shape?.nextField).toBe('next');
      expect(shape?.valueField).toBe('val');
      expect(shape?.confidence).toBe('high');
    });

    it('identifies doubly linked list with next and prev fields', () => {
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'DoublyNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 10 },
            next: { k: 'ref', id: '@2' },
            prev: { k: 'null' },
          },
        },
        '@2': {
          kind: 'object',
          type: 'DoublyNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 20 },
            next: { k: 'null' },
            prev: { k: 'ref', id: '@1' },
          },
        },
      };

      const shapes = analyzeClassShapes(heap);
      const shape = shapes.get('DoublyNode');
      expect(shape).toBeDefined();
      expect(shape?.kind).toBe('doublyLinkedList');
      expect(shape?.nextField).toBe('next');
      expect(shape?.prevField).toBe('prev');
      expect(shape?.confidence).toBe('high');
    });

    it('handles non-standard field names like data, nextNode, and link', () => {
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'AlphaNode',
          fields: {
            data: { k: 'prim', t: 'int', v: 10 },
            nextNode: { k: 'ref', id: '@2' },
          },
        },
        '@2': {
          kind: 'object',
          type: 'AlphaNode',
          fields: {
            data: { k: 'prim', t: 'int', v: 20 },
            nextNode: { k: 'null' },
          },
        },
      };

      const shapes = analyzeClassShapes(heap);
      const shape = shapes.get('AlphaNode');
      expect(shape?.kind).toBe('linkedList');
      expect(shape?.nextField).toBe('nextNode');
      expect(shape?.valueField).toBe('data');
      expect(shape?.confidence).toBe('high');
    });

    it('mixed-shape: classifies class with next and other as generic object, not linked list (MixedShape)', () => {
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'MixedNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 1 },
            next: { k: 'ref', id: '@2' },
            other: { k: 'ref', id: '@3' },
          },
        },
        '@2': {
          kind: 'object',
          type: 'MixedNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 2 },
            next: { k: 'null' },
            other: { k: 'null' },
          },
        },
        '@3': {
          kind: 'object',
          type: 'MixedNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 3 },
            next: { k: 'null' },
            other: { k: 'null' },
          },
        },
      };

      const shapes = analyzeClassShapes(heap);
      const shape = shapes.get('MixedNode');
      expect(shape).toBeDefined();
      expect(shape?.kind).toBe('object'); // fallback to generic object per DEC-009
    });
  });

  describe('Chains and Cycles', () => {
    it('cycles: pure cycle without a head (CircularList)', () => {
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 1 }, next: { k: 'ref', id: '@2' } },
        },
        '@2': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 2 }, next: { k: 'ref', id: '@1' } },
        },
      };

      const { chains, hasCycle } = buildChainsForComponent(
        ['@1', '@2'],
        'next',
        heap,
      );
      expect(hasCycle).toBe(true);
      expect(chains).toHaveLength(1);
      expect(chains[0].hasCycle).toBe(true);
      expect(chains[0].nodeIds).toHaveLength(2);
      expect(chains[0].cycleTargetId).toBe('@1');
    });

    it('cycles: rho-shaped cycle with head (CycleDetect)', () => {
      // 1 -> 2 -> 3 -> 4 -> 5 -> 3
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 1 }, next: { k: 'ref', id: '@2' } },
        },
        '@2': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 2 }, next: { k: 'ref', id: '@3' } },
        },
        '@3': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 3 }, next: { k: 'ref', id: '@4' } },
        },
        '@4': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 4 }, next: { k: 'ref', id: '@5' } },
        },
        '@5': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 5 }, next: { k: 'ref', id: '@3' } },
        },
      };

      const { chains, hasCycle } = buildChainsForComponent(
        ['@1', '@2', '@3', '@4', '@5'],
        'next',
        heap,
      );
      expect(hasCycle).toBe(true);
      expect(chains).toHaveLength(1);
      expect(chains[0].headId).toBe('@1');
      expect(chains[0].nodeIds).toEqual(['@1', '@2', '@3', '@4', '@5']);
      expect(chains[0].hasCycle).toBe(true);
      expect(chains[0].cycleTargetId).toBe('@3');
      expect(chains[0].cycleStartIndex).toBe(2);
    });

    it('cycles: self-loop node (next points to itself)', () => {
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 1 }, next: { k: 'ref', id: '@1' } },
        },
      };

      const { chains, hasCycle } = buildChainsForComponent(
        ['@1'],
        'next',
        heap,
      );
      expect(hasCycle).toBe(true);
      expect(chains).toHaveLength(1);
      expect(chains[0].nodeIds).toEqual(['@1']);
      expect(chains[0].hasCycle).toBe(true);
      expect(chains[0].cycleTargetId).toBe('@1');
      expect(chains[0].cycleStartIndex).toBe(0);
    });

    it('mid-reversal states: two disjoint chains mid-operation (ReverseIterative)', () => {
      // Chain A (reversed so far): @2 -> @1 -> null
      // Chain B (remaining): @3 -> @4 -> null
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 1 }, next: { k: 'null' } },
        },
        '@2': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 2 }, next: { k: 'ref', id: '@1' } },
        },
        '@3': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 3 }, next: { k: 'ref', id: '@4' } },
        },
        '@4': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 4 }, next: { k: 'null' } },
        },
      };

      const step: Step = {
        i: 35,
        event: 'line',
        line: 14,
        stack: [
          {
            frameId: 1,
            method: 'Main.main',
            signature: 'void main(String[])',
            line: 14,
            locals: [
              { name: 'prev', type: 'Node', value: { k: 'ref', id: '@2' } },
              { name: 'curr', type: 'Node', value: { k: 'ref', id: '@3' } },
            ],
          },
        ],
        heap,
        statics: [],
        returnValue: null,
        stdoutLen: 0,
        clipped: false,
      };

      const res = recognize(step);
      // Both components are recognized as linked list structures
      expect(res.structures).toHaveLength(2);
      const chainNodes = res.structures.map((s) => s.chains[0].nodeIds);
      expect(chainNodes).toContainEqual(['@2', '@1']);
      expect(chainNodes).toContainEqual(['@3', '@4']);
    });

    it('merge mid-state: multiple chains mid-merge (MergeTwoSorted)', () => {
      // dummy: @10 -> @1 -> @2
      // remaining l1: @3 -> @5
      // remaining l2: @4 -> @6
      const heap: Record<string, HeapObject> = {
        '@10': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 0 }, next: { k: 'ref', id: '@1' } },
        },
        '@1': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 1 }, next: { k: 'ref', id: '@2' } },
        },
        '@2': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 2 }, next: { k: 'null' } },
        },
        '@3': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 3 }, next: { k: 'ref', id: '@5' } },
        },
        '@5': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 5 }, next: { k: 'null' } },
        },
        '@4': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 4 }, next: { k: 'ref', id: '@6' } },
        },
        '@6': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 6 }, next: { k: 'null' } },
        },
      };

      const step: Step = {
        i: 20,
        event: 'line',
        line: 25,
        stack: [
          {
            frameId: 1,
            method: 'Main.main',
            signature: 'void main(String[])',
            line: 25,
            locals: [
              { name: 'dummy', type: 'Node', value: { k: 'ref', id: '@10' } },
              { name: 'p1', type: 'Node', value: { k: 'ref', id: '@3' } },
              { name: 'p2', type: 'Node', value: { k: 'ref', id: '@4' } },
            ],
          },
        ],
        heap,
        statics: [],
        returnValue: null,
        stdoutLen: 0,
        clipped: false,
      };

      const res = recognize(step);
      expect(res.structures).toHaveLength(3);
      const lengths = res.structures.map((s) => s.allNodeIds.length).sort();
      expect(lengths).toEqual([2, 2, 3]);
    });
  });

  describe('Wrapper Classes and Invariants', () => {
    it('wrapper classes: recognizes wrapper class and extracts head and size (WrapperClass)', () => {
      const heap: Record<string, HeapObject> = {
        '@100': {
          kind: 'object',
          type: 'MyLinkedList',
          fields: {
            head: { k: 'ref', id: '@1' },
            size: { k: 'prim', t: 'int', v: 2 },
          },
        },
        '@1': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 10 }, next: { k: 'ref', id: '@2' } },
        },
        '@2': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 30 }, next: { k: 'null' } },
        },
      };

      const { entryPoints, wrapper, absorbedWrapperId } = collectEntryPoints(
        ['@1', '@2'],
        heap,
        [
          {
            frameId: 1,
            method: 'Main.main',
            signature: 'void main(String[])',
            line: 8,
            locals: [
              { name: 'list', type: 'MyLinkedList', value: { k: 'ref', id: '@100' } },
            ],
          },
        ],
      );

      expect(absorbedWrapperId).toBe('@100');
      expect(wrapper).toBeDefined();
      expect(wrapper?.className).toBe('MyLinkedList');
      expect(wrapper?.variableName).toBe('list');
      expect(wrapper?.nonNodeFields.size).toEqual({ k: 'prim', t: 'int', v: 2 });

      expect(entryPoints).toContainEqual({
        label: 'list.head',
        target: '@1',
        source: 'field',
      });
    });

    it('doubly list: verifies next/prev links and invariant checks (DoublySingleBuild)', () => {
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'DoublyNode',
          fields: { val: { k: 'prim', v: 10 }, next: { k: 'ref', id: '@2' }, prev: { k: 'null' } },
        },
        '@2': {
          kind: 'object',
          type: 'DoublyNode',
          fields: { val: { k: 'prim', v: 20 }, next: { k: 'null' }, prev: { k: 'ref', id: '@1' } },
        },
      };

      const status1 = checkDoublyLinkStatus('@1', '@2', 'prev', heap);
      expect(status1.isValid).toBe(true);

      // Inconsistent mid-operation state: @2.prev is null instead of @1
      const brokenHeap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'DoublyNode',
          fields: { val: { k: 'prim', v: 10 }, next: { k: 'ref', id: '@2' }, prev: { k: 'null' } },
        },
        '@2': {
          kind: 'object',
          type: 'DoublyNode',
          fields: { val: { k: 'prim', v: 20 }, next: { k: 'null' }, prev: { k: 'null' } },
        },
      };

      const brokenStatus = checkDoublyLinkStatus('@1', '@2', 'prev', brokenHeap);
      expect(brokenStatus.isValid).toBe(false);
    });

    it('ghost tracking: computeGhosts identifies unlinked/orphaned nodes across steps (OrphanedNodes)', () => {
      const prevHeap: Record<string, HeapObject> = {
        '@1': { kind: 'object', type: 'Node', fields: {} },
        '@2': { kind: 'object', type: 'Node', fields: {} },
        '@3': { kind: 'object', type: 'Node', fields: {} },
      };
      const currHeap: Record<string, HeapObject> = {
        '@2': { kind: 'object', type: 'Node', fields: {} },
        '@3': { kind: 'object', type: 'Node', fields: {} },
      };

      const ghosts = computeGhosts(prevHeap, currHeap);
      expect(ghosts).toEqual(['@1']);
    });

    it('view as override: forces linked list to object when overridden', () => {
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'Node',
          fields: { val: { k: 'prim', v: 10 }, next: { k: 'null' } },
        },
      };
      const step: Step = {
        i: 1,
        event: 'line',
        line: 5,
        stack: [],
        heap,
        statics: [],
        returnValue: null,
        stdoutLen: 0,
        clipped: false,
      };

      const overrides = new Map<string, 'linkedList' | 'object'>();
      overrides.set('@1', 'object');

      const res = recognize(step, undefined, overrides);
      expect(res.structures).toHaveLength(0);
      expect(res.leftoverObjectIds).toContain('@1');
    });
  });

  // -------------------------------------------------------------------------
  // Real Fixture Trace Tests
  // -------------------------------------------------------------------------

  describe('Real Fixture Tests (tests/fixtures/traces)', () => {
    it('singly list: builds 4-node chain (SinglyBuild)', () => {
      const trace = loadFixture('singly-build-trace.json');
      const finalStep = trace.steps[trace.steps.length - 2];
      const res = recognize(finalStep);

      expect(res.structures).toHaveLength(1);
      const list = res.structures[0];
      expect(list.kind).toBe('linkedList');
      expect(list.chains[0].nodeIds).toHaveLength(4);
      expect(list.hasCycle).toBe(false);
      expect(list.confidence).toBe('high');
    });

    it('empty list: handles null head gracefully without error (EmptyList)', () => {
      const trace = loadFixture('empty-list-trace.json');
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step);

      expect(res.structures).toHaveLength(0);
      expect(res.leftoverObjectIds).toHaveLength(0);
    });

    it('single node: handles 1-node list with null next (SingleNode)', () => {
      const trace = loadFixture('single-node-trace.json');
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step);

      expect(res.structures).toHaveLength(1);
      const list = res.structures[0];
      expect(list.kind).toBe('linkedList');
      expect(list.chains[0].nodeIds).toHaveLength(1);
      expect(list.hasCycle).toBe(false);
    });

    it('long list: recognizes 30-node list (LongList)', () => {
      const trace = loadFixture('long-list-trace.json');
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step);

      expect(res.structures).toHaveLength(1);
      const list = res.structures[0];
      expect(list.kind).toBe('linkedList');
      expect(list.chains[0].nodeIds).toHaveLength(30);
      expect(list.hasCycle).toBe(false);
    });

    it('non-standard field names: recognizes data/nextNode and data/link (NonStandardNames)', () => {
      const trace = loadFixture('non-standard-names-trace.json');
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step);

      expect(res.structures.length).toBeGreaterThanOrEqual(2);
      const classes = res.structures.map((s) => s.className);
      expect(classes).toContain('AlphaNode');
      expect(classes).toContain('BetaNode');
    });

    it('mixed-shape: classifies class with next and other as generic object, not linked list (MixedShape)', () => {
      const trace = loadFixture('mixed-shape-trace.json');
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step);

      expect(res.structures).toHaveLength(0);
      expect(res.leftoverObjectIds.length).toBeGreaterThanOrEqual(1);
    });

    it('performance: recognizes 100-node heap snapshot in well under 10 ms', () => {
      const heap: Record<string, HeapObject> = {};
      for (let i = 1; i <= 100; i++) {
        heap[`@${i}`] = {
          kind: 'object',
          type: 'Node',
          fields: {
            val: { k: 'prim', t: 'int', v: i },
            next: i < 100 ? { k: 'ref', id: `@${i + 1}` } : { k: 'null' },
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
            method: 'Main.main',
            signature: 'void main(String[])',
            line: 1,
            locals: [{ name: 'head', type: 'Node', value: { k: 'ref', id: '@1' } }],
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

      expect(res.structures).toHaveLength(1);
      expect(res.structures[0].chains[0].nodeIds).toHaveLength(100);
      expect(durationMs).toBeLessThan(10); // PRD: well under 10 ms
      console.log(`Recognize 100-node heap benchmark: ${durationMs.toFixed(3)} ms`);
    });
  });
});
