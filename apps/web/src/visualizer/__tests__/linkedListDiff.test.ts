import { describe, it, expect } from 'vitest';
import {
  computeLinkedListDiff,
  stabilizeChainOrder,
  getAnimationDuration,
} from '../linkedListDiff';
import { computeLinkedListLayout } from '../linkedListLayout';
import type { LinkedListStructure, LinkedListChain, EntryPoint } from '../../recognition/types';
import type { HeapObject, InstanceObject } from '../../trace/types';

describe('Linked List Diff & Animation Suite (Stage 4)', () => {
  const makeNode = (val: number, nextId: string | null, prevId: string | null = null): InstanceObject => ({
    kind: 'object',
    type: 'Node',
    fields: {
      val: { k: 'prim', t: 'int', v: val },
      next: nextId ? { k: 'ref', id: nextId } : { k: 'null' },
      ...(prevId ? { prev: { k: 'ref', id: prevId } } : {}),
    },
  });

  const makeStruct = (
    nodeIds: string[],
    entryPoints: EntryPoint[] = [],
    isDoubly = false,
  ): LinkedListStructure => ({
    kind: isDoubly ? 'doublyLinkedList' : 'linkedList',
    className: 'Node',
    chains: [
      {
        headId: nodeIds[0] ?? 'null',
        nodeIds,
        hasCycle: false,
      },
    ],
    allNodeIds: nodeIds,
    entryPoints,
    confidence: 'high',
    valueField: 'val',
    nextField: 'next',
    ...(isDoubly ? { prevField: 'prev' } : {}),
    hasCycle: false,
    isFragment: false,
  });

  describe('Ghost Rule (Orphan / Garbage Tracking)', () => {
    it('marks a node as ghost when it becomes unreachable between step i and i+1 if showGhosts is true', () => {
      // Step i: list has @1, @2, @3
      const prevHeap: Record<string, HeapObject> = {
        '@1': makeNode(1, '@2'),
        '@2': makeNode(2, '@3'),
        '@3': makeNode(3, null),
      };
      const prevStruct = makeStruct(['@1', '@2', '@3'], [{ label: 'head', target: '@1', source: 'local' }]);

      // Step i+1: head = head.next (@1 becomes unreachable/orphan)
      const currHeap: Record<string, HeapObject> = {
        '@2': makeNode(2, '@3'),
        '@3': makeNode(3, null),
      };
      const currStruct = makeStruct(['@2', '@3'], [{ label: 'head', target: '@2', source: 'local' }]);

      const diffWithGhosts = computeLinkedListDiff(
        prevStruct,
        currStruct,
        prevHeap,
        currHeap,
        { showGhosts: true },
      );

      expect(diffWithGhosts.removedNodes.has('@1')).toBe(true);
      expect(diffWithGhosts.ghostNodes.length).toBe(1);
      expect(diffWithGhosts.ghostNodes[0].id).toBe('@1');
      expect(diffWithGhosts.ghostNodes[0].valString).toBe('1');
    });

    it('omits ghost nodes when showGhosts setting is false', () => {
      const prevHeap: Record<string, HeapObject> = {
        '@1': makeNode(1, '@2'),
        '@2': makeNode(2, null),
      };
      const prevStruct = makeStruct(['@1', '@2']);

      const currHeap: Record<string, HeapObject> = {
        '@2': makeNode(2, null),
      };
      const currStruct = makeStruct(['@2']);

      const diffNoGhosts = computeLinkedListDiff(
        prevStruct,
        currStruct,
        prevHeap,
        currHeap,
        { showGhosts: false },
      );

      expect(diffNoGhosts.removedNodes.has('@1')).toBe(true);
      expect(diffNoGhosts.ghostNodes.length).toBe(0);
    });

    it('ghost node disappears completely on step i+2', () => {
      // Step i+1: heap only had @2, @3 (and @1 was ghost from step i)
      const heapStep1: Record<string, HeapObject> = {
        '@2': makeNode(2, '@3'),
        '@3': makeNode(3, null),
      };
      const structStep1 = makeStruct(['@2', '@3']);

      // Step i+2: heap still has @2, @3
      const heapStep2: Record<string, HeapObject> = {
        '@2': makeNode(2, '@3'),
        '@3': makeNode(3, null),
      };
      const structStep2 = makeStruct(['@2', '@3']);

      // Between step i+1 and i+2, @1 is not in either, so no ghost
      const diffStep2 = computeLinkedListDiff(
        structStep1,
        structStep2,
        heapStep1,
        heapStep2,
        { showGhosts: true },
      );

      expect(diffStep2.ghostNodes.length).toBe(0);
    });
  });

  describe('Pointer Changes & Tag Moves', () => {
    it('detects next pointer change between steps', () => {
      const prevHeap: Record<string, HeapObject> = {
        '@1': makeNode(1, '@2'),
        '@2': makeNode(2, '@3'),
        '@3': makeNode(3, null),
      };
      const prevStruct = makeStruct(['@1', '@2', '@3']);

      // @2 next changed from @3 to null (e.g. truncation or reversal step)
      const currHeap: Record<string, HeapObject> = {
        '@1': makeNode(1, '@2'),
        '@2': makeNode(2, null),
        '@3': makeNode(3, null),
      };
      const currStruct = makeStruct(['@1', '@2']);

      const diff = computeLinkedListDiff(prevStruct, currStruct, prevHeap, currHeap);

      expect(diff.changedLinks.has('@2->null')).toBe(true);
      expect(diff.changedLinks.has('@2-next')).toBe(true);
      expect(diff.changedLinks.has('@1-next')).toBe(false);
    });

    it('detects prev pointer change in doubly linked list', () => {
      const prevHeap: Record<string, HeapObject> = {
        '@1': makeNode(1, '@2', null),
        '@2': makeNode(2, null, '@1'),
      };
      const prevStruct = makeStruct(['@1', '@2'], [], true);

      // Break backward pointer on @2
      const currHeap: Record<string, HeapObject> = {
        '@1': makeNode(1, '@2', null),
        '@2': makeNode(2, null, null),
      };
      const currStruct = makeStruct(['@1', '@2'], [], true);

      const diff = computeLinkedListDiff(prevStruct, currStruct, prevHeap, currHeap);

      expect(diff.changedLinks.has('@2<-null')).toBe(true);
      expect(diff.changedLinks.has('@2-prev')).toBe(true);
    });

    it('detects variable tags moving between nodes', () => {
      const heap: Record<string, HeapObject> = {
        '@1': makeNode(10, '@2'),
        '@2': makeNode(20, null),
      };
      const prevStruct = makeStruct(['@1', '@2'], [
        { label: 'curr', target: '@1', source: 'local' },
        { label: 'head', target: '@1', source: 'local' },
      ]);

      // curr advances to @2, head stays at @1, new tag nextPtr appears
      const currStruct = makeStruct(['@1', '@2'], [
        { label: 'head', target: '@1', source: 'local' },
        { label: 'curr', target: '@2', source: 'local' },
        { label: 'nextPtr', target: '@2', source: 'local' },
      ]);

      const diff = computeLinkedListDiff(prevStruct, currStruct, heap, heap);

      expect(diff.movedTags.has('curr')).toBe(true);
      expect(diff.movedTags.get('curr')).toEqual({ fromTarget: '@1', toTarget: '@2' });
      expect(diff.movedTags.has('head')).toBe(false);
      expect(diff.addedTags.has('nextPtr')).toBe(true);
    });

    it('detects node data value changes', () => {
      const prevHeap: Record<string, HeapObject> = {
        '@1': makeNode(10, null),
      };
      const prevStruct = makeStruct(['@1']);

      const currHeap: Record<string, HeapObject> = {
        '@1': makeNode(99, null),
      };
      const currStruct = makeStruct(['@1']);

      const diff = computeLinkedListDiff(prevStruct, currStruct, prevHeap, currHeap);

      expect(diff.changedDataNodes.has('@1')).toBe(true);
    });
  });

  describe('Backward Stepping Symmetry', () => {
    it('reverses additions, deletions, and link mutations when stepping backward', () => {
      // Step A: 2 nodes
      const heapA: Record<string, HeapObject> = {
        '@1': makeNode(1, '@2'),
        '@2': makeNode(2, null),
      };
      const structA = makeStruct(['@1', '@2']);

      // Step B: node @3 inserted between @1 and @2
      const heapB: Record<string, HeapObject> = {
        '@1': makeNode(1, '@3'),
        '@3': makeNode(99, '@2'),
        '@2': makeNode(2, null),
      };
      const structB = makeStruct(['@1', '@3', '@2']);

      // Forward step A -> B
      const forwardDiff = computeLinkedListDiff(structA, structB, heapA, heapB, { isBackward: false });
      expect(forwardDiff.addedNodes.has('@3')).toBe(true);
      expect(forwardDiff.changedLinks.has('@1->@3')).toBe(true);

      // Backward step B -> A
      const backwardDiff = computeLinkedListDiff(structA, structB, heapA, heapB, { isBackward: true });
      expect(backwardDiff.removedNodes.has('@3')).toBe(true); // @3 leaves when stepping backward
      expect(backwardDiff.changedLinks.has('@1->@2')).toBe(true); // @1 link reverts back to @2
    });
  });

  describe('Stable Vertical Chain Ordering', () => {
    it('maintains stable vertical ordering across steps mid-operation', () => {
      const chainPrev: LinkedListChain = {
        headId: '@prevHead',
        nodeIds: ['@prevHead', '@1'],
        hasCycle: false,
      };
      const chainCurr: LinkedListChain = {
        headId: '@currHead',
        nodeIds: ['@currHead', '@2', '@3'],
        hasCycle: false,
      };

      const prevChains = [chainPrev, chainCurr];

      // In current step, say buildChains happened to discover chainCurr first
      const rawCurrChains = [
        { headId: '@currHead', nodeIds: ['@currHead', '@2', '@3'], hasCycle: false },
        { headId: '@prevHead', nodeIds: ['@prevHead', '@1'], hasCycle: false },
      ];

      const stabilized = stabilizeChainOrder(rawCurrChains, prevChains);

      // Order must remain stable: prevHead first, currHead second
      expect(stabilized[0].headId).toBe('@prevHead');
      expect(stabilized[1].headId).toBe('@currHead');
    });
  });

  describe('Speed & Reduced Motion Adaptation', () => {
    it('adapts duration for 1x, 2x, 4x, and reduced motion', () => {
      expect(getAnimationDuration(1, false, false)).toBe(0.28);
      expect(getAnimationDuration(1, true, false)).toBe(0.28);
      expect(getAnimationDuration(2, true, false)).toBe(0.12);
      expect(getAnimationDuration(4, true, false)).toBe(0.05); // fast/shortened at 4x
      expect(getAnimationDuration(1, false, true)).toBe(0); // instant when reduced motion
    });
  });

  describe('Performance: 50-node list stepping through', () => {
    it('computes layout and diff for a 50-node list in well under 5 ms', () => {
      const nodeIds = Array.from({ length: 50 }, (_, i) => `@${i + 1}`);
      const prevHeap: Record<string, HeapObject> = {};
      const currHeap: Record<string, HeapObject> = {};

      for (let i = 0; i < 50; i++) {
        prevHeap[`@${i + 1}`] = makeNode(i, i + 1 < 50 ? `@${i + 2}` : null);
        // Curr heap with one link changed and one tag moved
        currHeap[`@${i + 1}`] = makeNode(i, i + 1 < 50 ? `@${i + 2}` : null);
      }
      currHeap['@25'] = makeNode(24, null); // link severed at mid

      const prevStruct = makeStruct(nodeIds, [{ label: 'curr', target: '@20', source: 'local' }]);
      const currStruct = makeStruct(nodeIds, [{ label: 'curr', target: '@25', source: 'local' }]);

      const start = performance.now();
      const iterations = 50;
      for (let i = 0; i < iterations; i++) {
        const diff = computeLinkedListDiff(prevStruct, currStruct, prevHeap, currHeap);
        computeLinkedListLayout(currStruct, currHeap, 800, 1, prevStruct, diff);
      }
      const elapsed = performance.now() - start;
      const avgPerStep = elapsed / iterations;

      console.log(`50-node stepping benchmark: ${avgPerStep.toFixed(3)} ms per step`);
      expect(avgPerStep).toBeLessThan(5.0);
    });
  });
});
