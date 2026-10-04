import { describe, it, expect } from 'vitest';
import {
  findFrameActiveNodeId,
  computeTreeActiveNodes,
} from '../treeActiveNodes';
import type { StackFrame, Step } from '../../../trace/types';
import type { BinaryTreeStructure } from '../../../recognition/types';

describe('treeActiveNodes (Phase 3 Stage 5)', () => {
  const dummyTree: BinaryTreeStructure = {
    kind: 'binaryTree',
    className: 'TreeNode',
    rootId: '@10',
    rootIds: ['@10'],
    allNodeIds: ['@10', '@20', '@30', '@40'],
    nodes: {
      '@10': { id: '@10', val: null, leftId: '@20', rightId: '@30', parentId: null },
      '@20': { id: '@20', val: null, leftId: '@40', rightId: null, parentId: '@10' },
      '@30': { id: '@30', val: null, leftId: null, rightId: null, parentId: '@10' },
      '@40': { id: '@40', val: null, leftId: null, rightId: null, parentId: '@20' },
    },
    brokenEdges: [],
    height: 3,
    nodeCount: 4,
    hasCycle: false,
    hasSharedNode: false,
    isFragment: false,
    confidence: 'high',
    valueField: 'val',
    leftField: 'left',
    rightField: 'right',
    entryPoints: [{ label: 'root', target: '@10', source: 'local' }],
  };

  const knownNodeIds = new Set(dummyTree.allNodeIds);

  describe('findFrameActiveNodeId', () => {
    it('prefers parameter matching priority name', () => {
      const frame: StackFrame = {
        frameId: 1,
        method: 'inorder',
        signature: '(LTreeNode;)V',
        line: 15,
        locals: [
          { name: 'node', type: 'TreeNode', value: { k: 'ref', id: '@20' } },
          { name: 'curr', type: 'TreeNode', value: { k: 'ref', id: '@10' } },
        ],
      };
      expect(findFrameActiveNodeId(frame, knownNodeIds)).toBe('@20');
    });

    it('prefers parameters over local variables', () => {
      const frame: StackFrame = {
        frameId: 2,
        method: 'traverse',
        signature: '(LTreeNode;)V',
        line: 20,
        locals: [
          // parameter is x
          { name: 'x', type: 'TreeNode', value: { k: 'ref', id: '@30' } },
          // local variable is node (priority name)
          { name: 'node', type: 'TreeNode', value: { k: 'ref', id: '@10' } },
        ],
      };
      // Parameter takes precedence over local variable even if local matches priority name
      expect(findFrameActiveNodeId(frame, knownNodeIds)).toBe('@30');
    });

    it('prefers priority named parameter over non-priority parameter', () => {
      const frame: StackFrame = {
        frameId: 3,
        method: 'swap',
        signature: '(LTreeNode;LTreeNode;)V',
        line: 25,
        locals: [
          { name: 'other', type: 'TreeNode', value: { k: 'ref', id: '@30' } },
          { name: 'curr', type: 'TreeNode', value: { k: 'ref', id: '@20' } },
        ],
      };
      expect(findFrameActiveNodeId(frame, knownNodeIds)).toBe('@20');
    });

    it('picks first parameter by declaration order when names tie', () => {
      const frame: StackFrame = {
        frameId: 4,
        method: 'compare',
        signature: '(LTreeNode;LTreeNode;)V',
        line: 30,
        locals: [
          { name: 'a', type: 'TreeNode', value: { k: 'ref', id: '@10' } },
          { name: 'b', type: 'TreeNode', value: { k: 'ref', id: '@20' } },
        ],
      };
      expect(findFrameActiveNodeId(frame, knownNodeIds)).toBe('@10');
    });

    it('falls back to local variable matching priority name when no parameters match', () => {
      const frame: StackFrame = {
        frameId: 5,
        method: 'main',
        signature: '([Ljava/lang/String;)V',
        line: 5,
        locals: [
          { name: 'args', type: 'String[]', value: { k: 'ref', id: '@arr' } },
          { name: 'temp', type: 'TreeNode', value: { k: 'ref', id: '@30' } },
          { name: 'root', type: 'TreeNode', value: { k: 'ref', id: '@10' } },
        ],
      };
      expect(findFrameActiveNodeId(frame, knownNodeIds)).toBe('@10');
    });

    it('falls back to first local by declaration order if no priority name matches', () => {
      const frame: StackFrame = {
        frameId: 6,
        method: 'main',
        signature: '([Ljava/lang/String;)V',
        line: 8,
        locals: [
          { name: 'args', type: 'String[]', value: { k: 'ref', id: '@arr' } },
          { name: 'firstTree', type: 'TreeNode', value: { k: 'ref', id: '@30' } },
          { name: 'secondTree', type: 'TreeNode', value: { k: 'ref', id: '@40' } },
        ],
      };
      expect(findFrameActiveNodeId(frame, knownNodeIds)).toBe('@30');
    });

    it('returns null if frame has no tree node reference', () => {
      const frame: StackFrame = {
        frameId: 7,
        method: 'compute',
        signature: '(II)I',
        line: 12,
        locals: [
          { name: 'a', type: 'int', value: { k: 'prim', v: 10 } },
          { name: 'b', type: 'int', value: { k: 'prim', v: 20 } },
        ],
      };
      expect(findFrameActiveNodeId(frame, knownNodeIds)).toBeNull();
    });
  });

  describe('computeTreeActiveNodes', () => {
    it('returns empty results on null or empty input', () => {
      const res = computeTreeActiveNodes(null, null);
      expect(res.activeNodeId).toBeNull();
      expect(res.suspendedNodeIds.size).toBe(0);
      expect(res.pathEdgeIds.size).toBe(0);
    });

    it('identifies active node, suspended nodes, and recursion path edges in a multi-frame call stack', () => {
      const step: Step = {
        i: 15,
        event: 'line',
        line: 18,
        stack: [
          {
            frameId: 1,
            method: 'main',
            signature: '([Ljava/lang/String;)V',
            line: 10,
            locals: [
              { name: 'root', type: 'TreeNode', value: { k: 'ref', id: '@10' } },
            ],
          },
          {
            frameId: 2,
            method: 'inorder',
            signature: '(LTreeNode;)V',
            line: 16,
            locals: [
              { name: 'node', type: 'TreeNode', value: { k: 'ref', id: '@20' } },
            ],
          },
          {
            frameId: 3,
            method: 'inorder',
            signature: '(LTreeNode;)V',
            line: 15,
            locals: [
              { name: 'node', type: 'TreeNode', value: { k: 'ref', id: '@40' } },
            ],
          },
        ],
        heap: {},
        statics: [],
        returnValue: null,
        stdoutLen: 0,
        clipped: false,
      };

      const res = computeTreeActiveNodes(step, dummyTree);

      // Active node is @40 (top frame)
      expect(res.activeNodeId).toBe('@40');

      // Suspended nodes are @10 (main) and @20 (inorder frame 2)
      expect(res.suspendedNodeIds).toEqual(new Set(['@10', '@20']));

      // Path edges: @10 -> @20 and @20 -> @40
      expect(res.pathEdgeIds).toEqual(new Set(['@10-@20', '@20-@40']));

      // Frame mapping
      expect(res.nodeToFrames.get('@40')?.map((f) => f.frameId)).toEqual([3]);
      expect(res.nodeToFrames.get('@20')?.map((f) => f.frameId)).toEqual([2]);
      expect(res.nodeToFrames.get('@10')?.map((f) => f.frameId)).toEqual([1]);
    });
  });
});
