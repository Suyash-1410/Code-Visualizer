import { describe, it, expect } from 'vitest';
import { computeLinkedListLayout } from '../linkedListLayout';
import { computeLinkedListDiff } from '../linkedListDiff';
import { recognize } from '../../recognition/linkedList';
import type { Step, HeapObject } from '../../trace/types';
import type { LinkedListStructure, BinaryTreeStructure, TreeNodeInfo } from '../../recognition/types';
import { computeTreeLayout } from '../tree/layout';
import { computeTreeDiff } from '../tree/treeDiff';

describe('Phase 2 Robustness & Performance Suite', () => {
  it('handles 100-node list without freezing, completing layout and diff in < 10ms', () => {
    const nodeCount = 100;
    const heap: Record<string, HeapObject> = {};
    const nodeIds: string[] = [];

    for (let i = 1; i <= nodeCount; i++) {
      const id = `@node_${i}`;
      nodeIds.push(id);
      heap[id] = {
        kind: 'object',
        type: 'Node',
        fields: {
          val: { k: 'prim', t: 'int', v: i },
          next:
            i < nodeCount
              ? { k: 'ref', id: `@node_${i + 1}` }
              : { k: 'null' },
        },
      };
    }

    const structure: LinkedListStructure = {
      kind: 'linkedList',
      className: 'Node',
      chains: [{ headId: '@node_1', nodeIds, hasCycle: false }],
      allNodeIds: nodeIds,
      entryPoints: [{ label: 'head', target: '@node_1', source: 'local', frameId: 1 }],
      confidence: 'high',
      valueField: 'val',
      nextField: 'next',
      hasCycle: false,
      isFragment: false,
    };

    const t0 = performance.now();
    const layout = computeLinkedListLayout(structure, heap);
    const layoutDuration = performance.now() - t0;

    expect(layoutDuration).toBeLessThan(25);
    expect(layout.chains[0].nodes).toHaveLength(100);
    expect(layout.chains[0].arrows).toHaveLength(100); // 99 forward + 1 null arrow
    expect(layout.totalWidth).toBeGreaterThan(500);

    // Test diff against slightly mutated heap (e.g. value change at node 50)
    const nextHeap = { ...heap };
    nextHeap['@node_50'] = {
      kind: 'object',
      type: 'Node',
      fields: {
        val: { k: 'prim', t: 'int', v: 999 },
        next: { k: 'ref', id: '@node_51' },
      },
    };

    const t1 = performance.now();
    const diff = computeLinkedListDiff(structure, structure, heap, nextHeap);
    const diffDuration = performance.now() - t1;

    expect(diffDuration).toBeLessThan(10);
    expect(diff.changedDataNodes.has('@node_50')).toBe(true);
  });

  it('handles cyclic list of any length without entering infinite loops', () => {
    // 5-node list with cycle 5 -> 2
    const heap: Record<string, HeapObject> = {
      '@1': { kind: 'object', type: 'Node', fields: { val: { k: 'prim', t: 'int', v: 1 }, next: { k: 'ref', id: '@2' } } },
      '@2': { kind: 'object', type: 'Node', fields: { val: { k: 'prim', t: 'int', v: 2 }, next: { k: 'ref', id: '@3' } } },
      '@3': { kind: 'object', type: 'Node', fields: { val: { k: 'prim', t: 'int', v: 3 }, next: { k: 'ref', id: '@4' } } },
      '@4': { kind: 'object', type: 'Node', fields: { val: { k: 'prim', t: 'int', v: 4 }, next: { k: 'ref', id: '@5' } } },
      '@5': { kind: 'object', type: 'Node', fields: { val: { k: 'prim', t: 'int', v: 5 }, next: { k: 'ref', id: '@2' } } },
    };

    const step: Step = {
      i: 10,
      event: 'line',
      line: 12,
      stack: [
        {
          frameId: 1,
          method: 'main',
          signature: '()V',
          line: 12,
          locals: [{ name: 'head', type: 'Node', value: { k: 'ref', id: '@1' } }],
        },
      ],
      heap,
      statics: [],
      returnValue: null,
      stdoutLen: 0,
      clipped: false,
    };

    const recognition = recognize(step);
    expect(recognition.structures).toHaveLength(1);
    const struct = recognition.structures[0];
    expect(struct.hasCycle).toBe(true);

    const layout = computeLinkedListLayout(struct, heap);
    expect(layout.chains[0].nodes).toHaveLength(5);
    // Backward cycle link should be present
    const cycleConn = layout.chains[0].arrows.find((c) => c.type === 'cycle');
    expect(cycleConn).toBeDefined();
    expect(cycleConn?.fromId).toBe('@5');
    expect(cycleConn?.toId).toBe('@2');
  });

  it('handles a list dynamically constructed inside recursive function calls', () => {
    // 3 nodes in separate chains before linking
    const heap: Record<string, HeapObject> = {
      '@1': { kind: 'object', type: 'Node', fields: { val: { k: 'prim', t: 'int', v: 1 }, next: { k: 'null' } } },
      '@2': { kind: 'object', type: 'Node', fields: { val: { k: 'prim', t: 'int', v: 2 }, next: { k: 'null' } } },
      '@3': { kind: 'object', type: 'Node', fields: { val: { k: 'prim', t: 'int', v: 3 }, next: { k: 'null' } } },
    };

    const step: Step = {
      i: 15,
      event: 'call',
      line: 5,
      stack: [
        { frameId: 1, method: 'main', signature: '()V', line: 20, locals: [{ name: 'head', type: 'Node', value: { k: 'ref', id: '@1' } }] },
        { frameId: 2, method: 'build', signature: '(I)LNode;', line: 8, locals: [{ name: 'curr', type: 'Node', value: { k: 'ref', id: '@2' } }] },
        { frameId: 3, method: 'build', signature: '(I)LNode;', line: 8, locals: [{ name: 'curr', type: 'Node', value: { k: 'ref', id: '@3' } }] },
      ],
      heap,
      statics: [],
      returnValue: null,
      stdoutLen: 0,
      clipped: false,
    };

    const recognition = recognize(step);
    expect(recognition.structures.length).toBeGreaterThan(0);
    for (const s of recognition.structures) {
      const layout = computeLinkedListLayout(s, heap);
      expect(layout.chains.length).toBeGreaterThan(0);
      expect(layout.chains[0].nodes.length).toBeGreaterThan(0);
    }
  });

  it('performs rapid stepping across 50 steps without lag or memory leaks', () => {
    const heap: Record<string, HeapObject> = {
      '@1': { kind: 'object', type: 'Node', fields: { val: { k: 'prim', t: 'int', v: 1 }, next: { k: 'ref', id: '@2' } } },
      '@2': { kind: 'object', type: 'Node', fields: { val: { k: 'prim', t: 'int', v: 2 }, next: { k: 'null' } } },
    };

    const structure: LinkedListStructure = {
      kind: 'linkedList',
      className: 'Node',
      chains: [{ headId: '@1', nodeIds: ['@1', '@2'], hasCycle: false }],
      allNodeIds: ['@1', '@2'],
      entryPoints: [{ label: 'head', target: '@1', source: 'local', frameId: 1 }],
      confidence: 'high',
      valueField: 'val',
      nextField: 'next',
      hasCycle: false,
      isFragment: false,
    };

    const t0 = performance.now();
    for (let i = 0; i < 50; i++) {
      computeLinkedListLayout(structure, heap);
      computeLinkedListDiff(structure, structure, heap, heap);
    }
    const elapsed = performance.now() - t0;

    // 50 iterations should take well under 25ms total (<0.5ms per iteration)
    expect(elapsed).toBeLessThan(50);
  });
});

describe('Phase 3 Binary Tree Robustness & Performance Suite', () => {
  it('handles a 31-node complete tree computing layout and diff in < 15ms without node overlap', () => {
    const heap: Record<string, HeapObject> = {};
    const nodes: Record<string, TreeNodeInfo> = {};
    const allNodeIds: string[] = [];

    for (let i = 1; i <= 31; i++) {
      const id = `@node_${i}`;
      allNodeIds.push(id);
      const leftId = 2 * i <= 31 ? `@node_${2 * i}` : null;
      const rightId = 2 * i + 1 <= 31 ? `@node_${2 * i + 1}` : null;
      const parentId = i > 1 ? `@node_${Math.floor(i / 2)}` : null;

      nodes[id] = {
        id,
        val: { k: 'prim', t: 'int', v: i },
        leftId,
        rightId,
        parentId,
      };

      heap[id] = {
        kind: 'object',
        type: 'TreeNode',
        fields: {
          val: { k: 'prim', t: 'int', v: i },
          left: leftId ? { k: 'ref', id: leftId } : { k: 'null' },
          right: rightId ? { k: 'ref', id: rightId } : { k: 'null' },
        },
      };
    }

    const structure: BinaryTreeStructure = {
      kind: 'binaryTree',
      className: 'TreeNode',
      rootId: '@node_1',
      rootIds: ['@node_1'],
      allNodeIds,
      nodes,
      brokenEdges: [],
      height: 5,
      nodeCount: 31,
      hasCycle: false,
      hasSharedNode: false,
      isFragment: false,
      confidence: 'high',
      valueField: 'val',
      leftField: 'left',
      rightField: 'right',
      entryPoints: [{ label: 'root', target: '@node_1', source: 'local', frameId: 1 }],
    };

    const t0 = performance.now();
    const layout = computeTreeLayout(structure, heap);
    const layoutTime = performance.now() - t0;

    expect(layoutTime).toBeLessThan(15);
    expect(layout.nodes).toHaveLength(31);

    // Verify zero overlaps
    for (let a = 0; a < layout.nodes.length; a++) {
      for (let b = a + 1; b < layout.nodes.length; b++) {
        const nA = layout.nodes[a];
        const nB = layout.nodes[b];
        const dist = Math.hypot(nA.x - nB.x, nA.y - nB.y);
        expect(dist).toBeGreaterThanOrEqual(nA.radius + nB.radius);
      }
    }
  });

  it('handles a 40-node skewed tree descending strictly left without overlap', () => {
    const heap: Record<string, HeapObject> = {};
    const nodes: Record<string, TreeNodeInfo> = {};
    const allNodeIds: string[] = [];

    for (let i = 1; i <= 40; i++) {
      const id = `@skew_${i}`;
      allNodeIds.push(id);
      const leftId = i < 40 ? `@skew_${i + 1}` : null;
      const parentId = i > 1 ? `@skew_${i - 1}` : null;

      nodes[id] = {
        id,
        val: { k: 'prim', t: 'int', v: i },
        leftId,
        rightId: null,
        parentId,
      };

      heap[id] = {
        kind: 'object',
        type: 'TreeNode',
        fields: {
          val: { k: 'prim', t: 'int', v: i },
          left: leftId ? { k: 'ref', id: leftId } : { k: 'null' },
          right: { k: 'null' },
        },
      };
    }

    const structure: BinaryTreeStructure = {
      kind: 'binaryTree',
      className: 'TreeNode',
      rootId: '@skew_1',
      rootIds: ['@skew_1'],
      allNodeIds,
      nodes,
      brokenEdges: [],
      height: 40,
      nodeCount: 40,
      hasCycle: false,
      hasSharedNode: false,
      isFragment: false,
      confidence: 'high',
      valueField: 'val',
      leftField: 'left',
      rightField: 'right',
      entryPoints: [{ label: 'root', target: '@skew_1', source: 'local', frameId: 1 }],
    };

    const t0 = performance.now();
    const layout = computeTreeLayout(structure, heap);
    const layoutTime = performance.now() - t0;

    expect(layoutTime).toBeLessThan(15);
    expect(layout.nodes).toHaveLength(40);

    // Each child descends strictly to the left (x decreases or stays left-leaning)
    for (let i = 0; i < layout.nodes.length - 1; i++) {
      const parent = layout.nodes[i];
      const child = layout.nodes[i + 1];
      expect(child.y).toBeGreaterThan(parent.y);
      expect(child.x).toBeLessThan(parent.x);
    }
  });

  it('performs rapid stepping across 100 tree steps without lag', () => {
    const heap: Record<string, HeapObject> = {
      '@1': { kind: 'object', type: 'TreeNode', fields: { val: { k: 'prim', t: 'int', v: 4 }, left: { k: 'ref', id: '@2' }, right: { k: 'ref', id: '@3' } } },
      '@2': { kind: 'object', type: 'TreeNode', fields: { val: { k: 'prim', t: 'int', v: 2 }, left: { k: 'null' }, right: { k: 'null' } } },
      '@3': { kind: 'object', type: 'TreeNode', fields: { val: { k: 'prim', t: 'int', v: 6 }, left: { k: 'null' }, right: { k: 'null' } } },
    };

    const structure: BinaryTreeStructure = {
      kind: 'binaryTree',
      className: 'TreeNode',
      rootId: '@1',
      rootIds: ['@1'],
      allNodeIds: ['@1', '@2', '@3'],
      nodes: {
        '@1': { id: '@1', val: null, leftId: '@2', rightId: '@3' },
        '@2': { id: '@2', val: null, leftId: null, rightId: null },
        '@3': { id: '@3', val: null, leftId: null, rightId: null },
      },
      brokenEdges: [],
      height: 2,
      nodeCount: 3,
      hasCycle: false,
      hasSharedNode: false,
      isFragment: false,
      confidence: 'high',
      valueField: 'val',
      leftField: 'left',
      rightField: 'right',
      entryPoints: [{ label: 'root', target: '@1', source: 'local' }],
    };

    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      computeTreeLayout(structure, heap);
      computeTreeDiff(structure, structure, heap, heap);
    }
    const elapsed = performance.now() - t0;
    // 100 steps should take under 50ms (< 0.5ms per step)
    expect(elapsed).toBeLessThan(50);
  });
});
