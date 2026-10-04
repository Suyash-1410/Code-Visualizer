import { describe, it, expect } from 'vitest';
import { computeActiveNodes } from '../activeNodes';
import type { Step } from '../../trace/types';
import type { LinkedListStructure } from '../../recognition/types';

describe('computeActiveNodes', () => {
  const dummyStructure: LinkedListStructure = {
    kind: 'linkedList',
    className: 'Node',
    chains: [{ headId: '@1', nodeIds: ['@1', '@2', '@3', '@4'], hasCycle: false }],
    allNodeIds: ['@1', '@2', '@3', '@4'],
    entryPoints: [],
    confidence: 'high',
    valueField: 'val',
    nextField: 'next',
    hasCycle: false,
    isFragment: false,
  };

  it('returns empty result when step or stack is empty', () => {
    const res = computeActiveNodes(null, [dummyStructure]);
    expect(res.activeNodeId).toBeNull();
    expect(res.suspendedNodeIds.size).toBe(0);
  });

  it('selects active node for single frame in main', () => {
    const step: Partial<Step> = {
      stack: [
        {
          frameId: 1,
          method: 'main',
          signature: '([Ljava/lang/String;)V',
          line: 10,
          locals: [
            { name: 'head', type: 'Node', value: { k: 'ref', id: '@1' } },
            { name: 'curr', type: 'Node', value: { k: 'ref', id: '@2' } },
          ],
        },
      ],
    };

    const res = computeActiveNodes(step as Step, [dummyStructure]);
    expect(res.activeNodeId).toBe('@1'); // 'head' has priority
    expect(res.suspendedNodeIds.size).toBe(0);
    expect(res.nodeToFrames.get('@1')).toHaveLength(1);
    expect(res.nodeToFrames.get('@2')).toHaveLength(1);
  });

  it('identifies top frame as active and suspended frames in recursion', () => {
    // 4 frames on stack: main -> reverse(1) -> reverse(2) -> reverse(3)
    const step: Partial<Step> = {
      stack: [
        {
          frameId: 1,
          method: 'main',
          signature: '()V',
          line: 20,
          locals: [{ name: 'list', type: 'Node', value: { k: 'ref', id: '@1' } }],
        },
        {
          frameId: 2,
          method: 'reverse',
          signature: '(LNode;)LNode;',
          line: 12,
          locals: [{ name: 'head', type: 'Node', value: { k: 'ref', id: '@1' } }],
        },
        {
          frameId: 3,
          method: 'reverse',
          signature: '(LNode;)LNode;',
          line: 12,
          locals: [{ name: 'head', type: 'Node', value: { k: 'ref', id: '@2' } }],
        },
        {
          frameId: 4,
          method: 'reverse',
          signature: '(LNode;)LNode;',
          line: 5,
          locals: [{ name: 'head', type: 'Node', value: { k: 'ref', id: '@3' } }],
        },
      ],
    };

    const res = computeActiveNodes(step as Step, [dummyStructure]);
    // Top frame (reverse 4) points to @3
    expect(res.activeNodeId).toBe('@3');
    // Suspended frames (1, 2, 3) point to @1 and @2
    expect(res.suspendedNodeIds.has('@1')).toBe(true);
    expect(res.suspendedNodeIds.has('@2')).toBe(true);
    expect(res.suspendedNodeIds.has('@3')).toBe(false); // active node not in suspended
    expect(res.nodeToFrames.get('@1')).toHaveLength(2); // main & reverse(1)
  });

  it('handles 10 frames on a 10-node list', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `@${i + 1}`);
    const largeStruct: LinkedListStructure = {
      ...dummyStructure,
      chains: [{ headId: ids[0], nodeIds: ids, hasCycle: false }],
      allNodeIds: ids,
    };

    const stack = ids.map((id, idx) => ({
      frameId: idx + 1,
      method: 'traverse',
      signature: '(LNode;)V',
      line: 8,
      locals: [{ name: 'head', type: 'Node', value: { k: 'ref' as const, id } }],
    }));

    const step: Partial<Step> = { stack };
    const res = computeActiveNodes(step as Step, [largeStruct]);

    expect(res.activeNodeId).toBe('@10');
    expect(res.suspendedNodeIds.size).toBe(9);
    for (let i = 1; i <= 9; i++) {
      expect(res.suspendedNodeIds.has(`@${i}`)).toBe(true);
    }
    expect(res.suspendedNodeIds.has('@10')).toBe(false);
  });
});
