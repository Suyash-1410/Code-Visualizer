import { describe, it, expect } from 'vitest';
import { validateBstOrder } from '../bstOrder';
import type { HeapObject } from '../../../trace/types';
import type { BinaryTreeStructure } from '../../../recognition/types';

describe('bstOrder (Phase 3 Stage 5)', () => {
  it('detects no violations on a valid BST', () => {
    const validBst: BinaryTreeStructure = {
      kind: 'binaryTree',
      className: 'TreeNode',
      rootId: '@10',
      rootIds: ['@10'],
      allNodeIds: ['@10', '@5', '@15', '@3', '@7'],
      nodes: {
        '@10': { id: '@10', val: null, leftId: '@5', rightId: '@15', parentId: null },
        '@5': { id: '@5', val: null, leftId: '@3', rightId: '@7', parentId: '@10' },
        '@15': { id: '@15', val: null, leftId: null, rightId: null, parentId: '@10' },
        '@3': { id: '@3', val: null, leftId: null, rightId: null, parentId: '@5' },
        '@7': { id: '@7', val: null, leftId: null, rightId: null, parentId: '@5' },
      },
      brokenEdges: [],
      height: 3,
      nodeCount: 5,
      hasCycle: false,
      hasSharedNode: false,
      isFragment: false,
      confidence: 'high',
      valueField: 'val',
      leftField: 'left',
      rightField: 'right',
      entryPoints: [{ label: 'root', target: '@10', source: 'local' }],
    };

    const heap: Record<string, HeapObject> = {
      '@10': { kind: 'object', type: 'TreeNode', fields: { val: { k: 'prim', v: 10 } } },
      '@5': { kind: 'object', type: 'TreeNode', fields: { val: { k: 'prim', v: 5 } } },
      '@15': { kind: 'object', type: 'TreeNode', fields: { val: { k: 'prim', v: 15 } } },
      '@3': { kind: 'object', type: 'TreeNode', fields: { val: { k: 'prim', v: 3 } } },
      '@7': { kind: 'object', type: 'TreeNode', fields: { val: { k: 'prim', v: 7 } } },
    };

    const violations = validateBstOrder(validBst, heap);
    expect(violations.size).toBe(0);
  });

  it('detects violation when left child is greater than ancestor root', () => {
    // Root = 10, Left = 5, Right child of 5 is 12 (12 > 5, but 12 > 10 which violates ancestor 10)
    const invalidBst: BinaryTreeStructure = {
      kind: 'binaryTree',
      className: 'TreeNode',
      rootId: '@10',
      rootIds: ['@10'],
      allNodeIds: ['@10', '@5', '@12'],
      nodes: {
        '@10': { id: '@10', val: null, leftId: '@5', rightId: null, parentId: null },
        '@5': { id: '@5', val: null, leftId: null, rightId: '@12', parentId: '@10' },
        '@12': { id: '@12', val: null, leftId: null, rightId: null, parentId: '@5' },
      },
      brokenEdges: [],
      height: 3,
      nodeCount: 3,
      hasCycle: false,
      hasSharedNode: false,
      isFragment: false,
      confidence: 'high',
      valueField: 'val',
      leftField: 'left',
      rightField: 'right',
      entryPoints: [{ label: 'root', target: '@10', source: 'local' }],
    };

    const heap: Record<string, HeapObject> = {
      '@10': { kind: 'object', type: 'TreeNode', fields: { val: { k: 'prim', v: 10 } } },
      '@5': { kind: 'object', type: 'TreeNode', fields: { val: { k: 'prim', v: 5 } } },
      '@12': { kind: 'object', type: 'TreeNode', fields: { val: { k: 'prim', v: 12 } } },
    };

    const violations = validateBstOrder(invalidBst, heap);
    expect(violations.size).toBe(1);
    expect(violations.has('@12')).toBe(true);
    expect(violations.get('@12')).toContain('value 12 is ≥ ancestor 10');
  });
});
