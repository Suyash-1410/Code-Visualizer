import { describe, it, expect } from 'vitest';
import {
  computeTreeDiff,
  computeGhosts,
  getAnimationDuration,
} from '../treeDiff';
import type { BinaryTreeStructure } from '../../../recognition/types';
import type { HeapObject, InstanceObject } from '../../../trace/types';

describe('treeDiff & computeGhosts', () => {
  const prevStruct: BinaryTreeStructure = {
    kind: 'binaryTree',
    className: 'TreeNode',
    rootId: '@1',
    rootIds: ['@1'],
    allNodeIds: ['@1', '@2', '@3'],
    nodes: {
      '@1': { id: '@1', val: { k: 'prim', t: 'int', v: 50 }, leftId: '@2', rightId: '@3', parentId: null },
      '@2': { id: '@2', val: { k: 'prim', t: 'int', v: 30 }, leftId: null, rightId: null, parentId: '@1' },
      '@3': { id: '@3', val: { k: 'prim', t: 'int', v: 70 }, leftId: null, rightId: null, parentId: '@1' },
    },
    brokenEdges: [],
    height: 2,
    nodeCount: 3,
    confidence: 'high',
    valueField: 'val',
    leftField: 'left',
    rightField: 'right',
    entryPoints: [{ label: 'root', target: '@1', source: 'local' }],
    hasCycle: false,
    hasSharedNode: false,
    isFragment: false,
  };

  const prevHeap: Record<string, HeapObject> = {
    '@1': {
      kind: 'object',
      type: 'TreeNode',
      fields: {
        val: { k: 'prim', t: 'int', v: 50 },
        left: { k: 'ref', id: '@2' },
        right: { k: 'ref', id: '@3' },
      },
    },
    '@2': {
      kind: 'object',
      type: 'TreeNode',
      fields: {
        val: { k: 'prim', t: 'int', v: 30 },
        left: { k: 'null' },
        right: { k: 'null' },
      },
    },
    '@3': {
      kind: 'object',
      type: 'TreeNode',
      fields: {
        val: { k: 'prim', t: 'int', v: 70 },
        left: { k: 'null' },
        right: { k: 'null' },
      },
    },
  };

  it('detects node insertion and new edges', () => {
    const currStruct: BinaryTreeStructure = {
      ...prevStruct,
      allNodeIds: ['@1', '@2', '@3', '@4'],
      nodes: {
        ...prevStruct.nodes,
        '@2': { id: '@2', val: { k: 'prim', t: 'int', v: 30 }, leftId: '@4', rightId: null, parentId: '@1' },
        '@4': { id: '@4', val: { k: 'prim', t: 'int', v: 20 }, leftId: null, rightId: null, parentId: '@2' },
      },
      nodeCount: 4,
      height: 3,
    };

    const currHeap: Record<string, HeapObject> = {
      ...prevHeap,
      '@2': {
        kind: 'object',
        type: 'TreeNode',
        fields: {
          val: { k: 'prim', t: 'int', v: 30 },
          left: { k: 'ref', id: '@4' },
          right: { k: 'null' },
        },
      },
      '@4': {
        kind: 'object',
        type: 'TreeNode',
        fields: {
          val: { k: 'prim', t: 'int', v: 20 },
          left: { k: 'null' },
          right: { k: 'null' },
        },
      },
    };

    const diff = computeTreeDiff(prevStruct, currStruct, prevHeap, currHeap);

    expect(diff.addedNodes.has('@4')).toBe(true);
    expect(diff.removedNodes.size).toBe(0);
    expect(diff.changedEdgeIds.has('@2->@4')).toBe(true);
    expect(diff.changedEdgeIds.has('@2-left')).toBe(true);
  });

  it('computes ghost node when a node is deleted and becomes unreachable', () => {
    // Node @2 is removed from tree and heap
    const currStruct: BinaryTreeStructure = {
      ...prevStruct,
      allNodeIds: ['@1', '@3'],
      nodes: {
        '@1': { id: '@1', val: { k: 'prim', t: 'int', v: 50 }, leftId: null, rightId: '@3', parentId: null },
        '@3': { id: '@3', val: { k: 'prim', t: 'int', v: 70 }, leftId: null, rightId: null, parentId: '@1' },
      },
      nodeCount: 2,
    };

    const currHeap: Record<string, HeapObject> = {
      '@1': {
        kind: 'object',
        type: 'TreeNode',
        fields: {
          val: { k: 'prim', t: 'int', v: 50 },
          left: { k: 'null' },
          right: { k: 'ref', id: '@3' },
        },
      },
      '@3': prevHeap['@3'],
    };

    // With showGhosts: true (default)
    const diff = computeTreeDiff(prevStruct, currStruct, prevHeap, currHeap);
    expect(diff.removedNodes.has('@2')).toBe(true);
    expect(diff.ghostNodes.length).toBe(1);
    expect(diff.ghostNodes[0].id).toBe('@2');
    expect(diff.ghostNodes[0].valString).toBe('30');

    // Also test standalone computeGhosts function
    const ghosts = computeGhosts(prevStruct, currStruct, prevHeap, currHeap, { showGhosts: true });
    expect(ghosts.length).toBe(1);
    expect(ghosts[0].id).toBe('@2');

    // With showGhosts: false (configurable setting)
    const noGhosts = computeGhosts(prevStruct, currStruct, prevHeap, currHeap, { showGhosts: false });
    expect(noGhosts.length).toBe(0);
  });

  it('detects pointer changes and edge rewirings during rotation', () => {
    // Right rotation on @1: @2 becomes root, @2.right becomes @1, @1.left becomes null
    const currStruct: BinaryTreeStructure = {
      ...prevStruct,
      rootId: '@2',
      rootIds: ['@2'],
      nodes: {
        '@2': { id: '@2', val: { k: 'prim', t: 'int', v: 30 }, leftId: null, rightId: '@1', parentId: null },
        '@1': { id: '@1', val: { k: 'prim', t: 'int', v: 50 }, leftId: null, rightId: '@3', parentId: '@2' },
        '@3': { id: '@3', val: { k: 'prim', t: 'int', v: 70 }, leftId: null, rightId: null, parentId: '@1' },
      },
    };

    const currHeap: Record<string, HeapObject> = {
      '@2': {
        kind: 'object',
        type: 'TreeNode',
        fields: {
          val: { k: 'prim', t: 'int', v: 30 },
          left: { k: 'null' },
          right: { k: 'ref', id: '@1' },
        },
      },
      '@1': {
        kind: 'object',
        type: 'TreeNode',
        fields: {
          val: { k: 'prim', t: 'int', v: 50 },
          left: { k: 'null' },
          right: { k: 'ref', id: '@3' },
        },
      },
      '@3': prevHeap['@3'],
    };

    const diff = computeTreeDiff(prevStruct, currStruct, prevHeap, currHeap);

    expect(diff.changedEdgeIds.has('@2->@1')).toBe(true);
    expect(diff.changedEdgeIds.has('@1-left')).toBe(true);
  });

  it('detects tag movement (e.g. curr sliding down the tree)', () => {
    const prevWithTags: BinaryTreeStructure = {
      ...prevStruct,
      entryPoints: [
        { label: 'root', target: '@1', source: 'local' },
        { label: 'curr', target: '@1', source: 'local' },
      ],
    };

    const currWithTags: BinaryTreeStructure = {
      ...prevStruct,
      entryPoints: [
        { label: 'root', target: '@1', source: 'local' },
        { label: 'curr', target: '@2', source: 'local' },
      ],
    };

    const diff = computeTreeDiff(prevWithTags, currWithTags, prevHeap, prevHeap);
    expect(diff.movedTags.has('curr')).toBe(true);
    expect(diff.movedTags.get('curr')).toEqual({
      fromTarget: '@1',
      toTarget: '@2',
    });
  });

  it('detects value mutation on tree node', () => {
    const currHeap: Record<string, HeapObject> = {
      ...prevHeap,
      '@1': {
        kind: 'object',
        type: 'TreeNode',
        fields: {
          ...((prevHeap['@1'] as InstanceObject).fields),
          val: { k: 'prim', t: 'int', v: 99 },
        },
      },
    };

    const diff = computeTreeDiff(prevStruct, prevStruct, prevHeap, currHeap);
    expect(diff.changedDataNodes.has('@1')).toBe(true);
    expect(diff.changedDataNodes.has('@2')).toBe(false);
  });

  it('supports backward stepping diff', () => {
    // Forward: added @4. Backward: removed @4.
    const currStruct: BinaryTreeStructure = {
      ...prevStruct,
      allNodeIds: ['@1', '@2', '@3', '@4'],
      nodes: {
        ...prevStruct.nodes,
        '@2': { id: '@2', val: { k: 'prim', t: 'int', v: 30 }, leftId: '@4', rightId: null, parentId: '@1' },
        '@4': { id: '@4', val: { k: 'prim', t: 'int', v: 20 }, leftId: null, rightId: null, parentId: '@2' },
      },
    };

    const diff = computeTreeDiff(prevStruct, currStruct, prevHeap, prevHeap, {
      isBackward: true,
    });

    // When isBackward is true, from=curr and to=prev
    expect(diff.removedNodes.has('@4')).toBe(true);
    expect(diff.addedNodes.size).toBe(0);
  });

  describe('getAnimationDuration', () => {
    it('returns 0 when prefersReducedMotion is true', () => {
      expect(getAnimationDuration(1, false, true)).toBe(0);
      expect(getAnimationDuration(1, true, true)).toBe(0);
    });

    it('returns 0.28s for standard manual stepping', () => {
      expect(getAnimationDuration(1, false, false)).toBe(0.28);
    });

    it('returns snappy durations for playing at high speeds', () => {
      expect(getAnimationDuration(4, true, false)).toBe(0.05);
      expect(getAnimationDuration(2, true, false)).toBe(0.12);
      expect(getAnimationDuration(1, true, false)).toBe(0.28);
    });
  });
});
