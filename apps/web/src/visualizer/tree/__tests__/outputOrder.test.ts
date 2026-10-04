import { describe, it, expect } from 'vitest';
import { parseOutputTokens } from '../outputOrder';
import type { HeapObject } from '../../../trace/types';
import type { BinaryTreeStructure } from '../../../recognition/types';

describe('outputOrder (Phase 3 Stage 5)', () => {
  const dummyTree: BinaryTreeStructure = {
    kind: 'binaryTree',
    className: 'TreeNode',
    rootId: '@4',
    rootIds: ['@4'],
    allNodeIds: ['@4', '@2', '@6', '@dup1', '@dup2'],
    nodes: {},
    brokenEdges: [],
    height: 2,
    nodeCount: 5,
    hasCycle: false,
    hasSharedNode: false,
    isFragment: false,
    confidence: 'high',
    valueField: 'val',
    leftField: 'left',
    rightField: 'right',
    entryPoints: [{ label: 'root', target: '@4', source: 'local' }],
  };

  const heap: Record<string, HeapObject> = {
    '@4': { kind: 'object', type: 'TreeNode', fields: { val: { k: 'prim', v: 4 } } },
    '@2': { kind: 'object', type: 'TreeNode', fields: { val: { k: 'prim', v: 2 } } },
    '@6': { kind: 'object', type: 'TreeNode', fields: { val: { k: 'prim', v: 6 } } },
    '@dup1': { kind: 'object', type: 'TreeNode', fields: { val: { k: 'prim', v: 9 } } },
    '@dup2': { kind: 'object', type: 'TreeNode', fields: { val: { k: 'prim', v: 9 } } },
  };

  it('returns empty array when stdout is empty', () => {
    expect(parseOutputTokens('', dummyTree, heap)).toEqual([]);
    expect(parseOutputTokens('   ', dummyTree, heap)).toEqual([]);
  });

  it('links uniquely matched tokens to tree nodes', () => {
    const stdout = '2 4 6';
    const tokens = parseOutputTokens(stdout, dummyTree, heap);
    expect(tokens).toHaveLength(3);
    expect(tokens[0]).toEqual({ id: 'token-0-2', text: '2', nodeId: '@2' });
    expect(tokens[1]).toEqual({ id: 'token-1-4', text: '4', nodeId: '@4' });
    expect(tokens[2]).toEqual({ id: 'token-2-6', text: '6', nodeId: '@6' });
  });

  it('does NOT link duplicate values in the tree', () => {
    const stdout = '9 9';
    const tokens = parseOutputTokens(stdout, dummyTree, heap);
    expect(tokens).toHaveLength(2);
    // Duplicate value '9' exists on both @dup1 and @dup2, so nodeId must be null (no guessing)
    expect(tokens[0].nodeId).toBeNull();
    expect(tokens[1].nodeId).toBeNull();
  });

  it('does NOT link arbitrary or non-matching text', () => {
    const stdout = 'Inorder: 2, 4, 6 done';
    const tokens = parseOutputTokens(stdout, dummyTree, heap);
    expect(tokens.find((t) => t.text === 'Inorder:')?.nodeId).toBeNull();
    expect(tokens.find((t) => t.text === 'done')?.nodeId).toBeNull();
    expect(tokens.find((t) => t.text === '2')?.nodeId).toBe('@2');
    expect(tokens.find((t) => t.text === '4')?.nodeId).toBe('@4');
    expect(tokens.find((t) => t.text === '6')?.nodeId).toBe('@6');
  });
});
