import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  analyzeClassShapes,
  computeGhosts,
  recognize,
} from '../linkedList';
import {
  getNodeRoles,
  computeTreeHeight,
  resolveChildFields,
  isStandardTreePair,
} from '../binaryTree';
import type {
  HeapObject,
  Step,
  Trace,
  StackFrame,
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

describe('Binary Tree Recognition Suite (Phase 3 Stage 2)', () => {
  // -------------------------------------------------------------------------
  // Helper pure functions: isStandardTreePair, resolveChildFields, computeTreeHeight
  // -------------------------------------------------------------------------
  describe('Helper pure functions', () => {
    it('isStandardTreePair correctly identifies standard left/right pairs', () => {
      expect(isStandardTreePair('left', 'right')).toBe(true);
      expect(isStandardTreePair('l', 'r')).toBe(true);
      expect(isStandardTreePair('leftChild', 'rightChild')).toBe(true);
      expect(isStandardTreePair('right', 'left')).toBe(true);
      expect(isStandardTreePair('prev', 'next')).toBe(false);
      expect(isStandardTreePair('a', 'b')).toBe(false);
    });

    it('resolveChildFields resolves standard and non-standard field pairs', () => {
      expect(resolveChildFields('right', 'left')).toEqual({
        leftField: 'left',
        rightField: 'right',
        confidence: 'high',
      });
      expect(resolveChildFields('branch1', 'branch2')).toEqual({
        leftField: 'branch1',
        rightField: 'branch2',
        confidence: 'low',
      });
    });

    it('computeTreeHeight calculates tree height', () => {
      expect(computeTreeHeight(null, {})).toBe(0);
      expect(
        computeTreeHeight('@1', {
          '@1': { id: '@1', val: null, leftId: '@2', rightId: null },
          '@2': { id: '@2', val: null, leftId: null, rightId: null },
        }),
      ).toBe(2);
    });
  });

  describe('Class-shape classification rules', () => {
    it('recognizes standard binary tree node (left and right) with high confidence', () => {
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 10 },
            left: { k: 'ref', id: '@2' },
            right: { k: 'null' },
          },
        },
        '@2': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 5 },
            left: { k: 'null' },
            right: { k: 'null' },
          },
        },
      };

      const shapes = analyzeClassShapes(heap);
      const shape = shapes.get('TreeNode');
      expect(shape).toBeDefined();
      expect(shape?.kind).toBe('binaryTree');
      expect(shape?.leftField).toBe('left');
      expect(shape?.rightField).toBe('right');
      expect(shape?.confidence).toBe('high');
      expect(shape?.valueField).toBe('val');
    });

    it('recognizes short field names (l and r) with high confidence', () => {
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'ShortNode',
          fields: {
            data: { k: 'prim', t: 'int', v: 100 },
            l: { k: 'ref', id: '@2' },
            r: { k: 'null' },
          },
        },
        '@2': {
          kind: 'object',
          type: 'ShortNode',
          fields: {
            data: { k: 'prim', t: 'int', v: 50 },
            l: { k: 'null' },
            r: { k: 'null' },
          },
        },
      };

      const shapes = analyzeClassShapes(heap);
      const shape = shapes.get('ShortNode');
      expect(shape?.kind).toBe('binaryTree');
      expect(shape?.leftField).toBe('l');
      expect(shape?.rightField).toBe('r');
      expect(shape?.confidence).toBe('high');
      expect(shape?.valueField).toBe('data');
    });

    it('recognizes leftChild and rightChild with high confidence', () => {
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'CustomNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 1 },
            leftChild: { k: 'ref', id: '@2' },
            rightChild: { k: 'null' },
          },
        },
        '@2': {
          kind: 'object',
          type: 'CustomNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 2 },
            leftChild: { k: 'null' },
            rightChild: { k: 'null' },
          },
        },
      };

      const shapes = analyzeClassShapes(heap);
      const shape = shapes.get('CustomNode');
      expect(shape?.kind).toBe('binaryTree');
      expect(shape?.leftField).toBe('leftChild');
      expect(shape?.rightField).toBe('rightChild');
      expect(shape?.confidence).toBe('high');
    });

    it('recognizes non-standard tree field names with low confidence and preserves declaration order', () => {
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'BranchNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 10 },
            branchA: { k: 'ref', id: '@2' },
            branchB: { k: 'ref', id: '@3' },
          },
        },
        '@2': {
          kind: 'object',
          type: 'BranchNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 5 },
            branchA: { k: 'null' },
            branchB: { k: 'null' },
          },
        },
        '@3': {
          kind: 'object',
          type: 'BranchNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 15 },
            branchA: { k: 'null' },
            branchB: { k: 'null' },
          },
        },
      };

      const shapes = analyzeClassShapes(heap);
      const shape = shapes.get('BranchNode');
      expect(shape?.kind).toBe('binaryTree');
      expect(shape?.leftField).toBe('branchA');
      expect(shape?.rightField).toBe('branchB');
      expect(shape?.confidence).toBe('low');
    });

    it('recognizes node with left, right, and parent pointer back-reference (ParentPointerTree)', () => {
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'ParentTreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 50 },
            left: { k: 'ref', id: '@2' },
            right: { k: 'null' },
            parent: { k: 'null' },
          },
        },
        '@2': {
          kind: 'object',
          type: 'ParentTreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 30 },
            left: { k: 'null' },
            right: { k: 'null' },
            parent: { k: 'ref', id: '@1' },
          },
        },
      };

      const shapes = analyzeClassShapes(heap);
      const shape = shapes.get('ParentTreeNode');
      expect(shape?.kind).toBe('binaryTree');
      expect(shape?.leftField).toBe('left');
      expect(shape?.rightField).toBe('right');
      expect(shape?.parentField).toBe('parent');
      expect(shape?.confidence).toBe('high');
    });

    it('ThreeChildFields: classifies class with three child fields (left, middle, right) as generic object', () => {
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'TriNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 10 },
            left: { k: 'ref', id: '@2' },
            middle: { k: 'ref', id: '@3' },
            right: { k: 'null' },
          },
        },
        '@2': {
          kind: 'object',
          type: 'TriNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 20 },
            left: { k: 'null' },
            middle: { k: 'null' },
            right: { k: 'null' },
          },
        },
        '@3': {
          kind: 'object',
          type: 'TriNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 30 },
            left: { k: 'null' },
            middle: { k: 'null' },
            right: { k: 'null' },
          },
        },
      };

      const shapes = analyzeClassShapes(heap);
      const shape = shapes.get('TriNode');
      expect(shape?.kind).toBe('object');
    });

    it('LeftRightAsList: classifies left/right node as tree by default, converts to doublyLinkedList on override', () => {
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'ListNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 1 },
            left: { k: 'null' },
            right: { k: 'ref', id: '@2' },
          },
        },
        '@2': {
          kind: 'object',
          type: 'ListNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 2 },
            left: { k: 'ref', id: '@1' },
            right: { k: 'null' },
          },
        },
      };

      // 1. By default -> tree
      const shapes = analyzeClassShapes(heap);
      expect(shapes.get('ListNode')?.kind).toBe('binaryTree');

      const step: Step = {
        i: 0,
        event: 'line',
        line: 1,
        stack: [
          {
            frameId: 1,
            method: 'Main.main',
            signature: 'void main(String[])',
            line: 1,
            locals: [
              { name: 'n1', type: 'ListNode', value: { k: 'ref', id: '@1' } },
            ],
          },
        ],
        heap,
        statics: [],
        returnValue: null,
        stdoutLen: 0,
        clipped: false,
      };

      const defaultResult = recognize(step);
      expect(defaultResult.trees.length).toBe(1);
      expect(defaultResult.trees[0].className).toBe('ListNode');
      expect(defaultResult.structures.length).toBe(0);

      // 2. With override -> doublyLinkedList
      const overriddenResult = recognize(
        step,
        undefined,
        new Map([['@1', 'doublyLinkedList']]),
      );
      expect(overriddenResult.trees.length).toBe(0);
      expect(overriddenResult.structures.length).toBe(1);
      expect(overriddenResult.structures[0].kind).toBe('doublyLinkedList');
      expect(overriddenResult.structures[0].allNodeIds).toEqual(['@1', '@2']);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Safety: Cycles and Shared Subtrees (DEC-016)
  // -------------------------------------------------------------------------
  describe('Safety: Cycles & Shared Subtree Detection', () => {
    it('cycles: detects child pointing back to ancestor, sets hasCycle=true, drops confidence to low, and records broken cycle edge (BrokenCycleTree)', () => {
      // 1 -> left: 2 -> left: 4 -> right: 1 (cycle)
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 1 },
            left: { k: 'ref', id: '@2' },
            right: { k: 'null' },
          },
        },
        '@2': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 2 },
            left: { k: 'ref', id: '@4' },
            right: { k: 'null' },
          },
        },
        '@4': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 4 },
            left: { k: 'null' },
            right: { k: 'ref', id: '@1' }, // back-edge to ancestor root
          },
        },
      };

      const step: Step = {
        i: 0,
        event: 'line',
        line: 1,
        stack: [
          {
            frameId: 1,
            method: 'Main.main',
            signature: 'void main(String[])',
            line: 1,
            locals: [
              { name: 'root', type: 'TreeNode', value: { k: 'ref', id: '@1' } },
            ],
          },
        ],
        heap,
        statics: [],
        returnValue: null,
        stdoutLen: 0,
        clipped: false,
      };

      const result = recognize(step);
      expect(result.trees.length).toBe(1);
      const tree = result.trees[0];
      expect(tree.hasCycle).toBe(true);
      expect(tree.confidence).toBe('low');
      expect(tree.brokenEdges.length).toBe(1);
      expect(tree.brokenEdges[0]).toEqual({
        fromId: '@4',
        toId: '@1',
        childSide: 'right',
        reason: 'cycle',
      });
      // Traversal terminates without infinite loop
      expect(tree.allNodeIds).toEqual(['@1', '@2', '@4']);
      expect(tree.nodeCount).toBe(3);
    });

    it('shared subtrees: detects multiple parents pointing to same child, sets hasSharedNode=true, drops confidence to low, and breaks duplicate edge (SharedSubtree)', () => {
      // root (1) -> left (2), right (3)
      // left.right -> shared (99)
      // right.left -> shared (99)
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 1 },
            left: { k: 'ref', id: '@2' },
            right: { k: 'ref', id: '@3' },
          },
        },
        '@2': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 2 },
            left: { k: 'null' },
            right: { k: 'ref', id: '@99' },
          },
        },
        '@3': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 3 },
            left: { k: 'ref', id: '@99' }, // second incoming parent
            right: { k: 'null' },
          },
        },
        '@99': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 99 },
            left: { k: 'null' },
            right: { k: 'null' },
          },
        },
      };

      const step: Step = {
        i: 0,
        event: 'line',
        line: 1,
        stack: [
          {
            frameId: 1,
            method: 'Main.main',
            signature: 'void main(String[])',
            line: 1,
            locals: [
              { name: 'root', type: 'TreeNode', value: { k: 'ref', id: '@1' } },
            ],
          },
        ],
        heap,
        statics: [],
        returnValue: null,
        stdoutLen: 0,
        clipped: false,
      };

      const result = recognize(step);
      expect(result.trees.length).toBe(1);
      const tree = result.trees[0];
      expect(tree.hasSharedNode).toBe(true);
      expect(tree.confidence).toBe('low');
      expect(tree.allNodeIds).toEqual(['@1', '@2', '@3', '@99']);
      expect(tree.nodeCount).toBe(4);
      expect(tree.brokenEdges.length).toBe(1);
      expect(tree.brokenEdges[0].toId).toBe('@99');
      expect(tree.brokenEdges[0].reason).toBe('shared');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Roots, Multi-Tree, Disjoint Forests, and Mid-State Fragments
  // -------------------------------------------------------------------------
  describe('Roots, Disjoint Trees, and Fragments', () => {
    it('rotation mid-states: handles detached subtrees and multi-root states during AVL rotation (AvlRightRotate)', () => {
      // Mid-rotation state: y.left = t2; x is about to become root
      // x has left: t1, right: t2. y has left: t2.
      // Both x and y have in-degree 0; t2 is referenced by both.
      const heap: Record<string, HeapObject> = {
        '@y': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 30 },
            left: { k: 'ref', id: '@t2' },
            right: { k: 'null' },
          },
        },
        '@x': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 20 },
            left: { k: 'ref', id: '@t1' },
            right: { k: 'ref', id: '@t2' },
          },
        },
        '@t1': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 10 },
            left: { k: 'null' },
            right: { k: 'null' },
          },
        },
        '@t2': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 25 },
            left: { k: 'null' },
            right: { k: 'null' },
          },
        },
      };

      const step: Step = {
        i: 0,
        event: 'line',
        line: 1,
        stack: [
          {
            frameId: 1,
            method: 'Main.main',
            signature: 'void main(String[])',
            line: 1,
            locals: [
              { name: 'y', type: 'TreeNode', value: { k: 'ref', id: '@y' } },
              { name: 'x', type: 'TreeNode', value: { k: 'ref', id: '@x' } },
            ],
          },
        ],
        heap,
        statics: [],
        returnValue: null,
        stdoutLen: 0,
        clipped: false,
      };

      const result = recognize(step);
      expect(result.trees.length).toBe(1);
      const tree = result.trees[0];
      // Both @y and @x are recorded in rootIds
      expect(tree.rootIds.length).toBe(2);
      expect(tree.allNodeIds).toContain('@x');
      expect(tree.allNodeIds).toContain('@y');
      expect(tree.allNodeIds).toContain('@t1');
      expect(tree.allNodeIds).toContain('@t2');
      expect(tree.nodeCount).toBe(4);
    });

    it('recognizes two distinct trees at once alive in main (TwoTreesAtOnce)', () => {
      // Tree A (1, 2, 3) and Tree B (10, 20, 30)
      const heap: Record<string, HeapObject> = {
        '@1': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 1 },
            left: { k: 'ref', id: '@2' },
            right: { k: 'ref', id: '@3' },
          },
        },
        '@2': {
          kind: 'object',
          type: 'TreeNode',
          fields: { val: { k: 'prim', t: 'int', v: 2 }, left: { k: 'null' }, right: { k: 'null' } },
        },
        '@3': {
          kind: 'object',
          type: 'TreeNode',
          fields: { val: { k: 'prim', t: 'int', v: 3 }, left: { k: 'null' }, right: { k: 'null' } },
        },
        '@10': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 10 },
            left: { k: 'ref', id: '@20' },
            right: { k: 'ref', id: '@30' },
          },
        },
        '@20': {
          kind: 'object',
          type: 'TreeNode',
          fields: { val: { k: 'prim', t: 'int', v: 20 }, left: { k: 'null' }, right: { k: 'null' } },
        },
        '@30': {
          kind: 'object',
          type: 'TreeNode',
          fields: { val: { k: 'prim', t: 'int', v: 30 }, left: { k: 'null' }, right: { k: 'null' } },
        },
      };

      const step: Step = {
        i: 0,
        event: 'line',
        line: 1,
        stack: [
          {
            frameId: 1,
            method: 'Main.main',
            signature: 'void main(String[])',
            line: 1,
            locals: [
              { name: 'treeA', type: 'TreeNode', value: { k: 'ref', id: '@1' } },
              { name: 'treeB', type: 'TreeNode', value: { k: 'ref', id: '@10' } },
            ],
          },
        ],
        heap,
        statics: [],
        returnValue: null,
        stdoutLen: 0,
        clipped: false,
      };

      const result = recognize(step);
      expect(result.trees.length).toBe(2);
      expect(result.trees[0].rootId).toBe('@1');
      expect(result.trees[0].nodeCount).toBe(3);
      expect(result.trees[1].rootId).toBe('@10');
      expect(result.trees[1].nodeCount).toBe(3);
    });

    it('recognizes single node tree (SingleTreeNode)', () => {
      const heap: Record<string, HeapObject> = {
        '@42': {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: 42 },
            left: { k: 'null' },
            right: { k: 'null' },
          },
        },
      };

      const step: Step = {
        i: 0,
        event: 'line',
        line: 1,
        stack: [
          {
            frameId: 1,
            method: 'Main.main',
            signature: 'void main(String[])',
            line: 1,
            locals: [
              { name: 'root', type: 'TreeNode', value: { k: 'ref', id: '@42' } },
            ],
          },
        ],
        heap,
        statics: [],
        returnValue: null,
        stdoutLen: 0,
        clipped: false,
      };

      const result = recognize(step);
      expect(result.trees.length).toBe(1);
      expect(result.trees[0].rootId).toBe('@42');
      expect(result.trees[0].nodeCount).toBe(1);
      expect(result.trees[0].height).toBe(1);
    });

    it('recognizes empty tree when root is null (EmptyTree)', () => {
      const heap: Record<string, HeapObject> = {};
      const step: Step = {
        i: 0,
        event: 'line',
        line: 1,
        stack: [
          {
            frameId: 1,
            method: 'Main.main',
            signature: 'void main(String[])',
            line: 1,
            locals: [
              { name: 'root', type: 'TreeNode', value: { k: 'null' } },
            ],
          },
        ],
        heap,
        statics: [],
        returnValue: null,
        stdoutLen: 0,
        clipped: false,
      };

      const result = recognize(step);
      expect(result.trees.length).toBe(1);
      expect(result.trees[0].rootId).toBeNull();
      expect(result.trees[0].nodeCount).toBe(0);
      expect(result.trees[0].height).toBe(0);
      expect(result.trees[0].entryPoints.some((ep) => ep.isNull)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Role tagging and Ghost tracking
  // -------------------------------------------------------------------------
  describe('Role Tagging & Ghost Tracking', () => {
    it('getNodeRoles maps active and caller frame references correctly', () => {
      const tree = {
        kind: 'binaryTree' as const,
        className: 'TreeNode',
        rootId: '@1',
        rootIds: ['@1'],
        allNodeIds: ['@1', '@2', '@3'],
        nodes: {},
        brokenEdges: [],
        height: 2,
        nodeCount: 3,
        hasCycle: false,
        hasSharedNode: false,
        isFragment: false,
        confidence: 'high' as const,
        valueField: 'val',
        leftField: 'left',
        rightField: 'right',
        entryPoints: [],
      };

      const frames: StackFrame[] = [
        {
          frameId: 1,
          method: 'Main.main',
          signature: 'void main(String[])',
          line: 10,
          locals: [
            { name: 'root', type: 'TreeNode', value: { k: 'ref', id: '@1' } },
          ],
        },
        {
          frameId: 2,
          method: 'Main.traverse',
          signature: 'void traverse(TreeNode)',
          line: 25,
          locals: [
            { name: 'node', type: 'TreeNode', value: { k: 'ref', id: '@2' } },
          ],
        },
      ];

      const roles = getNodeRoles(tree, frames);
      expect(roles.get('@1')?.length).toBe(1);
      expect(roles.get('@1')![0].varName).toBe('root');
      expect(roles.get('@1')![0].isTopFrame).toBe(false);

      expect(roles.get('@2')?.length).toBe(1);
      expect(roles.get('@2')![0].varName).toBe('node');
      expect(roles.get('@2')![0].isTopFrame).toBe(true);
    });

    it('computeGhosts identifies deleted nodes becoming unreachable', () => {
      const prevHeap: Record<string, HeapObject> = {
        '@root': { kind: 'object', type: 'TreeNode', fields: {} },
        '@deletedNode': { kind: 'object', type: 'TreeNode', fields: {} },
      };
      const currHeap: Record<string, HeapObject> = {
        '@root': { kind: 'object', type: 'TreeNode', fields: {} },
      };

      const ghosts = computeGhosts(prevHeap, currHeap);
      expect(ghosts).toEqual(['@deletedNode']);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Real Fixtures Verification (tests/fixtures/traces/)
  // -------------------------------------------------------------------------
  describe('Real Fixture Tests (tests/fixtures/traces)', () => {
    it('FullTree15: recognizes 15-node complete binary tree with height 4', () => {
      const trace = loadFixture('full-tree15-trace.json');
      const lastStep = trace.steps[trace.steps.length - 2];
      const result = recognize(lastStep);

      expect(result.trees.length).toBe(1);
      const tree = result.trees[0];
      expect(tree.nodeCount).toBe(15);
      expect(tree.height).toBe(4);
      expect(tree.hasCycle).toBe(false);
      expect(tree.hasSharedNode).toBe(false);
      expect(tree.confidence).toBe('high');
      expect(tree.entryPoints.some((ep) => ep.label === 'root')).toBe(true);
    });

    it('BstInsertRecursive: recognizes 7-node BST with correct height', () => {
      const trace = loadFixture('bst-insert-recursive-trace.json');
      const lastStep = trace.steps[trace.steps.length - 2];
      const result = recognize(lastStep);

      expect(result.trees.length).toBe(1);
      const tree = result.trees[0];
      expect(tree.nodeCount).toBe(7);
      expect(tree.height).toBe(3);
      expect(tree.confidence).toBe('high');
    });

    it('SkewedLeft and SkewedRight: recognizes 15-node degenerate skewed trees with height 15', () => {
      const leftTrace = loadFixture('skewed-left-trace.json');
      const leftStep = leftTrace.steps[leftTrace.steps.length - 2];
      const leftResult = recognize(leftStep);

      expect(leftResult.trees.length).toBe(1);
      expect(leftResult.trees[0].nodeCount).toBe(15);
      expect(leftResult.trees[0].height).toBe(15);

      const rightTrace = loadFixture('skewed-right-trace.json');
      const rightStep = rightTrace.steps[rightTrace.steps.length - 2];
      const rightResult = recognize(rightStep);

      expect(rightResult.trees.length).toBe(1);
      expect(rightResult.trees[0].nodeCount).toBe(15);
      expect(rightResult.trees[0].height).toBe(15);
    });

    it('ParentPointerTree: recognizes parent pointer back-reference', () => {
      const trace = loadFixture('parent-pointer-tree-trace.json');
      const lastStep = trace.steps[trace.steps.length - 2];
      const result = recognize(lastStep);

      expect(result.trees.length).toBe(1);
      const tree = result.trees[0];
      expect(tree.nodeCount).toBe(3);
      expect(tree.parentField).toBe('parent');
      expect(tree.confidence).toBe('high');
    });

    it('WrapperBst: recognizes user wrapper class BST holding root and size', () => {
      const trace = loadFixture('wrapper-bst-trace.json');
      const lastStep = trace.steps[trace.steps.length - 2];
      const result = recognize(lastStep);

      expect(result.trees.length).toBe(1);
      const tree = result.trees[0];
      expect(tree.nodeCount).toBe(3);
      expect(tree.wrapper).toBeDefined();
      expect(tree.wrapper?.className).toBe('BST');
      expect(tree.wrapper?.nonNodeFields.size).toBeDefined();
    });

    it('ThreeChildFields: leaves 3-child node in leftoverObjectIds without misidentifying as tree', () => {
      const trace = loadFixture('three-child-fields-trace.json');
      const lastStep = trace.steps[trace.steps.length - 2];
      const result = recognize(lastStep);

      expect(result.trees.length).toBe(0);
      expect(result.structures.length).toBe(0);
      expect(result.leftoverObjectIds.length).toBeGreaterThan(0);
    });

    it('BrokenCycleTree: identifies cycle in real trace fixture', () => {
      const trace = loadFixture('broken-cycle-tree-trace.json');
      const lastStep = trace.steps[trace.steps.length - 2];
      const result = recognize(lastStep);

      expect(result.trees.length).toBe(1);
      const tree = result.trees[0];
      expect(tree.hasCycle).toBe(true);
      expect(tree.confidence).toBe('low');
      expect(tree.brokenEdges.length).toBe(1);
      expect(tree.brokenEdges[0].reason).toBe('cycle');
    });

    it('SharedSubtree: identifies shared node in real trace fixture', () => {
      const trace = loadFixture('shared-subtree-trace.json');
      const lastStep = trace.steps[trace.steps.length - 2];
      const result = recognize(lastStep);

      expect(result.trees.length).toBe(1);
      const tree = result.trees[0];
      expect(tree.hasSharedNode).toBe(true);
      expect(tree.confidence).toBe('low');
      expect(tree.brokenEdges.length).toBe(1);
      expect(tree.brokenEdges[0].reason).toBe('shared');
    });

    it('LeftRightAsList: overrides tree to doublyLinkedList in real trace fixture', () => {
      const trace = loadFixture('left-right-as-list-trace.json');
      const lastStep = trace.steps[trace.steps.length - 2];

      // Default: tree
      const defaultRes = recognize(lastStep);
      expect(defaultRes.trees.length).toBe(1);
      expect(defaultRes.structures.length).toBe(0);

      // Override: doublyLinkedList
      const overridden = recognize(
        lastStep,
        undefined,
        new Map([[defaultRes.trees[0].rootId!, 'doublyLinkedList']]),
      );
      expect(overridden.trees.length).toBe(0);
      expect(overridden.structures.length).toBe(1);
      expect(overridden.structures[0].kind).toBe('doublyLinkedList');
    });

    it('performance: recognizes 100-node heap snapshot in well under 10 ms', () => {
      // Build a synthetic 100-node BST snapshot
      const heap: Record<string, HeapObject> = {};
      for (let i = 1; i <= 100; i++) {
        const leftId = 2 * i <= 100 ? `@${2 * i}` : null;
        const rightId = 2 * i + 1 <= 100 ? `@${2 * i + 1}` : null;
        heap[`@${i}`] = {
          kind: 'object',
          type: 'TreeNode',
          fields: {
            val: { k: 'prim', t: 'int', v: i },
            left: leftId ? { k: 'ref', id: leftId } : { k: 'null' },
            right: rightId ? { k: 'ref', id: rightId } : { k: 'null' },
          },
        };
      }

      const step: Step = {
        i: 0,
        event: 'line',
        line: 1,
        stack: [
          {
            frameId: 1,
            method: 'Main.main',
            signature: 'void main(String[])',
            line: 1,
            locals: [
              { name: 'root', type: 'TreeNode', value: { k: 'ref', id: '@1' } },
            ],
          },
        ],
        heap,
        statics: [],
        returnValue: null,
        stdoutLen: 0,
        clipped: false,
      };

      // Warm-up
      recognize(step);

      // Measure 50 iterations
      const start = performance.now();
      const iterations = 50;
      for (let i = 0; i < iterations; i++) {
        recognize(step);
      }
      const elapsed = performance.now() - start;
      const msPerRun = elapsed / iterations;

      console.log(
        `Recognize 100-node tree benchmark: ${msPerRun.toFixed(3)} ms per run`,
      );
      expect(msPerRun).toBeLessThan(10);
    });
  });
});
