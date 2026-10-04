import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { TreeView } from '../TreeView';
import { recognize } from '../../../recognition';
import type { BinaryTreeStructure } from '../../../recognition/types';
import type { HeapObject, Trace, Value } from '../../../trace/types';
import type { NodeProgressState } from '../treeProgress';

const fixturesDir = path.resolve(
  __dirname,
  '../../../../../../tests/fixtures/traces',
);

function loadFixture(filename: string): Trace {
  let filePath = path.join(fixturesDir, filename);
  if (!fs.existsSync(filePath)) {
    const base = filename.replace(/-trace\.json$/, '').replace(/\.json$/, '');
    const dashed = base.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    const candidate1 = path.join(fixturesDir, `${dashed}-trace.json`);
    const candidate2 = path.join(fixturesDir, `${base}.json`);
    if (fs.existsSync(candidate1)) {
      filePath = candidate1;
    } else if (fs.existsSync(candidate2)) {
      filePath = candidate2;
    }
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

// Helper to construct a synthetic BinaryTreeStructure
function createTreeStructure(
  rootId: string | null,
  nodes: Record<
    string,
    { val: number | Value | null | string; leftId: string | null; rightId: string | null; parentId?: string | null }
  >,
  overrides?: Partial<BinaryTreeStructure>,
): BinaryTreeStructure {
  const allNodeIds = Object.keys(nodes);
  return {
    kind: 'binaryTree',
    className: 'TreeNode',
    rootId,
    rootIds: rootId ? [rootId] : [],
    allNodeIds,
    nodes: Object.fromEntries(
      Object.entries(nodes).map(([id, n]) => [
        id,
        {
          id,
          val:
            n.val === null
              ? null
              : typeof n.val === 'object'
                ? n.val
                : { k: 'prim', t: typeof n.val === 'number' ? 'int' : 'str', v: n.val },
          leftId: n.leftId,
          rightId: n.rightId,
          parentId: n.parentId,
        },
      ]),
    ),
    brokenEdges: [],
    height: 3,
    nodeCount: allNodeIds.length,
    hasCycle: false,
    hasSharedNode: false,
    isFragment: false,
    confidence: 'high',
    valueField: 'val',
    leftField: 'left',
    rightField: 'right',
    entryPoints: rootId
      ? [{ label: 'root', target: rootId, source: 'local', isNull: false }]
      : [{ label: 'root', target: 'null', source: 'local', isNull: true }],
    ...overrides,
  };
}

function createHeap(
  nodes: Record<string, { val: number; leftId: string | null; rightId: string | null }>,
): Record<string, HeapObject> {
  const heap: Record<string, HeapObject> = {};
  for (const [id, n] of Object.entries(nodes)) {
    heap[id] = {
      kind: 'object',
      type: 'TreeNode',
      fields: {
        val: { k: 'prim', t: 'int', v: n.val },
        left: n.leftId ? { k: 'ref', id: n.leftId } : { k: 'null' },
        right: n.rightId ? { k: 'ref', id: n.rightId } : { k: 'null' },
      },
    };
  }
  return heap;
}

describe('TreeView Component Tests (Phase 3 Stage 3)', () => {
  it('renders a 3-node binary tree with nodes, values, edges, and tags', () => {
    const struct = createTreeStructure('@1', {
      '@1': { val: 50, leftId: '@2', rightId: '@3' },
      '@2': { val: 30, leftId: null, rightId: null },
      '@3': { val: 70, leftId: null, rightId: null },
    });
    const heap = createHeap({
      '@1': { val: 50, leftId: '@2', rightId: '@3' },
      '@2': { val: 30, leftId: null, rightId: null },
      '@3': { val: 70, leftId: null, rightId: null },
    });

    render(<TreeView structure={struct} heap={heap} />);

    // Values in nodes
    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('70')).toBeInTheDocument();

    // Variable chip
    expect(screen.getByText('root')).toBeInTheDocument();

    // Node count in header
    expect(screen.getByText(/\(3 nodes, height 3\)/)).toBeInTheDocument();
  });

  it('renders null variables in dedicated null area (curr = null)', () => {
    const struct = createTreeStructure(
      '@1',
      {
        '@1': { val: 42, leftId: null, rightId: null },
      },
      {
        entryPoints: [
          { label: 'root', target: '@1', source: 'local', isNull: false },
          { label: 'curr', target: 'null', source: 'local', isNull: true },
        ],
      },
    );
    const heap = createHeap({
      '@1': { val: 42, leftId: null, rightId: null },
    });

    render(<TreeView structure={struct} heap={heap} />);

    expect(screen.getByText('null references:')).toBeInTheDocument();
    expect(screen.getByText('curr = null')).toBeInTheDocument();
  });

  it('toggles null children stubs via checkbox', () => {
    const struct = createTreeStructure('@1', {
      '@1': { val: 10, leftId: '@2', rightId: null },
      '@2': { val: 5, leftId: null, rightId: null },
    });
    const heap = createHeap({
      '@1': { val: 10, leftId: '@2', rightId: null },
      '@2': { val: 5, leftId: null, rightId: null },
    });

    const onToggle = vi.fn();
    render(
      <TreeView
        structure={struct}
        heap={heap}
        showNullChildren={false}
        onToggleNullChildren={onToggle}
      />,
    );

    const checkbox = screen.getByLabelText(/Show null children/i);
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('renders wrapper object header when wrapper is present', () => {
    const struct = createTreeStructure(
      '@1',
      {
        '@1': { val: 50, leftId: null, rightId: null },
      },
      {
        wrapper: {
          id: '@99',
          className: 'BST',
          variableName: 'tree',
          nonNodeFields: {
            size: { k: 'prim', t: 'int', v: 1 },
          },
        },
      },
    );
    const heap = createHeap({
      '@1': { val: 50, leftId: null, rightId: null },
    });
    heap['@99'] = {
      kind: 'object',
      type: 'BST',
      fields: {
        root: { k: 'ref', id: '@1' },
        size: { k: 'prim', t: 'int', v: 1 },
      },
    };

    render(<TreeView structure={struct} heap={heap} />);

    expect(screen.getByText(/BST \(tree\)/)).toBeInTheDocument();
    expect(screen.getByText(/size: 1/)).toBeInTheDocument();
  });

  it('displays warning badge and broken edge for cycles without hanging', () => {
    const struct = createTreeStructure(
      '@1',
      {
        '@1': { val: 10, leftId: '@2', rightId: null },
        '@2': { val: 20, leftId: null, rightId: null },
      },
      {
        hasCycle: true,
        confidence: 'low',
        brokenEdges: [{ fromId: '@2', toId: '@1', childSide: 'right', reason: 'cycle' }],
      },
    );
    const heap = createHeap({
      '@1': { val: 10, leftId: '@2', rightId: null },
      '@2': { val: 20, leftId: null, rightId: null },
    });

    render(<TreeView structure={struct} heap={heap} />);

    expect(screen.getByText(/Cycle detected/i)).toBeInTheDocument();
    expect(screen.getByText(/right \(broken\)/i)).toBeInTheDocument();
  });

  it('"View as..." menu opens and calls onViewOverride', () => {
    const struct = createTreeStructure('@1', {
      '@1': { val: 10, leftId: '@2', rightId: null },
      '@2': { val: 5, leftId: null, rightId: null },
    });
    const heap = createHeap({
      '@1': { val: 10, leftId: '@2', rightId: null },
      '@2': { val: 5, leftId: null, rightId: null },
    });

    const onOverride = vi.fn();
    render(<TreeView structure={struct} heap={heap} onViewOverride={onOverride} />);

    // Click dropdown button
    const dropdownBtn = screen.getByText(/Detected as: Binary tree/i);
    fireEvent.click(dropdownBtn);

    // Click "Linked list" option
    const listOption = screen.getByText('Linked list');
    expect(listOption).toBeInTheDocument();
    fireEvent.click(listOption);

    expect(onOverride).toHaveBeenCalledWith('@1', 'linkedList');
  });

  // -------------------------------------------------------------------------
  // Real Fixtures Rendering Tests
  // -------------------------------------------------------------------------
  describe('Fixed Fixtures Visual Snapshots', () => {
    it('FullTree15 fixture: recognizes and renders 15 nodes symmetrically', () => {
      const trace = loadFixture('fulltree15-trace.json');
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step);

      expect(res.trees.length).toBe(1);
      const tree = res.trees[0];
      expect(tree.nodeCount).toBe(15);

      const { container } = render(<TreeView structure={tree} heap={step.heap} />);
      const circles = container.querySelectorAll('.nodes circle');
      expect(circles.length).toBe(15);
    });

    it('SkewedLeft fixture: recognizes and renders 15 nodes descending to the left', () => {
      const trace = loadFixture('skewedleft-trace.json');
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step);

      expect(res.trees.length).toBe(1);
      const tree = res.trees[0];
      expect(tree.nodeCount).toBe(15);

      const { container } = render(<TreeView structure={tree} heap={step.heap} />);
      const circles = container.querySelectorAll('.nodes circle');
      expect(circles.length).toBe(15);
    });

    it('LeftOnly fixture: renders 2 nodes with child on the left', () => {
      const trace = loadFixture('leftonly-trace.json');
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step);

      expect(res.trees.length).toBe(1);
      const tree = res.trees[0];
      expect(tree.nodeCount).toBe(2);

      render(<TreeView structure={tree} heap={step.heap} />);
      expect(screen.getByText('10')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('ParentPointerTree fixture: renders nodes without parent as an edge', () => {
      const trace = loadFixture('parentpointertree-trace.json');
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step);

      expect(res.trees.length).toBe(1);
      const tree = res.trees[0];
      expect(tree.parentField).toBe('parent');

      const { container } = render(<TreeView structure={tree} heap={step.heap} />);
      // Only 2 parent-to-child edges (left, right), NOT 4
      const edges = container.querySelectorAll('.edges path');
      expect(edges.length).toBe(2);
    });

    it('BrokenCycleTree fixture: renders cycle warning badge without hanging', () => {
      const trace = loadFixture('brokencycletree-trace.json');
      const step = trace.steps[trace.steps.length - 2];
      const res = recognize(step);

      expect(res.trees.length).toBe(1);
      const tree = res.trees[0];
      expect(tree.hasCycle).toBe(true);

      render(<TreeView structure={tree} heap={step.heap} />);
      expect(screen.getByText(/Cycle detected/i)).toBeInTheDocument();
    });
  });

  describe('Stage 4 Animation and Restructuring Rendering', () => {
    it('renders rewired/changed edges with amber highlight', () => {
      const struct = createTreeStructure('@1', {
        '@1': { val: 10, leftId: '@2', rightId: null, parentId: null },
        '@2': { val: 5, leftId: null, rightId: null, parentId: '@1' },
      });
      const heap = {
        '@1': {
          kind: 'object' as const,
          type: 'TreeNode',
          fields: { val: { k: 'prim' as const, t: 'int', v: 10 }, left: { k: 'ref' as const, id: '@2' }, right: { k: 'null' as const } },
        },
        '@2': {
          kind: 'object' as const,
          type: 'TreeNode',
          fields: { val: { k: 'prim' as const, t: 'int', v: 5 }, left: { k: 'null' as const }, right: { k: 'null' as const } },
        },
      };

      const diffResult = {
        addedNodes: new Set<string>(),
        removedNodes: new Set<string>(),
        changedDataNodes: new Set<string>(),
        changedEdgeIds: new Set(['@1->@2', '@1-left']),
        rewiredEdges: [{ id: '@1->@2', fromId: '@1', toId: '@2', side: 'left' as const, changeType: 'created' as const }],
        movedTags: new Map(),
        addedTags: new Set<string>(),
        removedTags: new Set<string>(),
        ghostNodes: [],
      };

      const { container } = render(
        <TreeView structure={struct} heap={heap} diffResult={diffResult} />,
      );

      const edgePath = container.querySelector('[data-testid="edge-@1-@2"]');
      expect(edgePath).toBeInTheDocument();
      expect(edgePath?.getAttribute('class')).toContain('stroke-amber-400');
    });

    it('renders ghost nodes with dimmed style and ghost badge when node is removed', () => {
      const struct = createTreeStructure('@1', {
        '@1': { val: 50, leftId: null, rightId: null, parentId: null },
      });
      const heap = {
        '@1': {
          kind: 'object' as const,
          type: 'TreeNode',
          fields: { val: { k: 'prim' as const, t: 'int', v: 50 }, left: { k: 'null' as const }, right: { k: 'null' as const } },
        },
      };

      const diffResult = {
        addedNodes: new Set<string>(),
        removedNodes: new Set(['@2']),
        changedDataNodes: new Set<string>(),
        changedEdgeIds: new Set<string>(),
        rewiredEdges: [],
        movedTags: new Map(),
        addedTags: new Set<string>(),
        removedTags: new Set<string>(),
        ghostNodes: [
          {
            id: '@2',
            valString: '20',
            fields: { val: { k: 'prim' as const, t: 'int', v: 20 } },
            lastX: 120,
            lastY: 100,
          },
        ],
      };

      render(
        <TreeView
          structure={struct}
          heap={heap}
          diffResult={diffResult}
          showGhosts={true}
        />,
      );

      // Ghost node should be rendered with value 20 and ghost badge
      expect(screen.getByText('20')).toBeInTheDocument();
      expect(screen.getByText(/ghost/i)).toBeInTheDocument();
      expect(screen.getByTestId('ghost-badge-2')).toBeInTheDocument();
    });

    it('highlights mutated values on existing tree nodes', () => {
      const struct = createTreeStructure('@1', {
        '@1': { val: 99, leftId: null, rightId: null, parentId: null },
      });
      const heap = {
        '@1': {
          kind: 'object' as const,
          type: 'TreeNode',
          fields: { val: { k: 'prim' as const, t: 'int', v: 99 }, left: { k: 'null' as const }, right: { k: 'null' as const } },
        },
      };

      const diffResult = {
        addedNodes: new Set<string>(),
        removedNodes: new Set<string>(),
        changedDataNodes: new Set(['@1']),
        changedEdgeIds: new Set<string>(),
        rewiredEdges: [],
        movedTags: new Map(),
        addedTags: new Set<string>(),
        removedTags: new Set<string>(),
        ghostNodes: [],
      };

      const { container } = render(
        <TreeView structure={struct} heap={heap} diffResult={diffResult} />,
      );

      const nodeCircle = container.querySelector('[data-testid="node-1"] circle');
      expect(nodeCircle?.getAttribute('class')).toContain('stroke-amber-400');
      const valText = screen.getByText('99');
      expect(valText.getAttribute('class')).toContain('fill-amber-300');
    });

    it('renders attached variable tags with layoutId', () => {
      const struct = createTreeStructure('@1', {
        '@1': { val: 42, leftId: null, rightId: null, parentId: null },
      }, {
        entryPoints: [
          { label: 'root', target: '@1', source: 'local' },
          { label: 'curr', target: '@1', source: 'local' },
        ],
      });
      const heap = {
        '@1': {
          kind: 'object' as const,
          type: 'TreeNode',
          fields: { val: { k: 'prim' as const, t: 'int', v: 42 }, left: { k: 'null' as const }, right: { k: 'null' as const } },
        },
      };

      render(<TreeView structure={struct} heap={heap} />);

      expect(screen.getByTestId('tag-root')).toBeInTheDocument();
      expect(screen.getByTestId('tag-curr')).toBeInTheDocument();
    });
  });

  describe('Stage 5: Call Stack Connection, Recursion Progress & Output Order', () => {
    it('renders progress legend and progress styles for nodes', () => {
      const struct = createTreeStructure('@4', {
        '@4': { val: 4, leftId: '@2', rightId: '@6', parentId: null },
        '@2': { val: 2, leftId: null, rightId: null, parentId: '@4' },
        '@6': { val: 6, leftId: null, rightId: null, parentId: '@4' },
      });
      const heap = {
        '@4': {
          kind: 'object' as const,
          type: 'TreeNode',
          fields: { val: { k: 'prim' as const, v: 4 }, left: { k: 'ref' as const, id: '@2' }, right: { k: 'ref' as const, id: '@6' } },
        },
        '@2': {
          kind: 'object' as const,
          type: 'TreeNode',
          fields: { val: { k: 'prim' as const, v: 2 }, left: { k: 'null' as const }, right: { k: 'null' as const } },
        },
        '@6': {
          kind: 'object' as const,
          type: 'TreeNode',
          fields: { val: { k: 'prim' as const, v: 6 }, left: { k: 'null' as const }, right: { k: 'null' as const } },
        },
      };

      const progressStates = new Map<string, NodeProgressState>([
        ['@4', 'in_progress'],
        ['@2', 'active'],
        ['@6', 'unvisited'],
      ]);

      render(
        <TreeView
          structure={struct}
          heap={heap}
          activeNodeId="@2"
          suspendedNodeIds={new Set(['@4'])}
          progressStates={progressStates}
        />,
      );

      // Legend present
      expect(screen.getByTestId('tree-progress-legend')).toBeInTheDocument();

      // Nodes have data-progress attribute
      expect(screen.getByTestId('node-2')).toHaveAttribute('data-progress', 'active');
      expect(screen.getByTestId('node-4')).toHaveAttribute('data-progress', 'in_progress');
      expect(screen.getByTestId('node-6')).toHaveAttribute('data-progress', 'unvisited');
    });

    it('emphasizes recursion path edges', () => {
      const struct = createTreeStructure('@4', {
        '@4': { val: 4, leftId: '@2', rightId: null, parentId: null },
        '@2': { val: 2, leftId: null, rightId: null, parentId: '@4' },
      });
      const heap = {
        '@4': {
          kind: 'object' as const,
          type: 'TreeNode',
          fields: { val: { k: 'prim' as const, v: 4 }, left: { k: 'ref' as const, id: '@2' }, right: { k: 'null' as const } },
        },
        '@2': {
          kind: 'object' as const,
          type: 'TreeNode',
          fields: { val: { k: 'prim' as const, v: 2 }, left: { k: 'null' as const }, right: { k: 'null' as const } },
        },
      };

      const pathEdgeIds = new Set(['@4-@2']);

      const { container } = render(
        <TreeView
          structure={struct}
          heap={heap}
          activeNodeId="@2"
          suspendedNodeIds={new Set(['@4'])}
          pathEdgeIds={pathEdgeIds}
        />,
      );

      const pathEdge = container.querySelector('[data-testid="edge-@4-@2"]');
      expect(pathEdge?.getAttribute('class')).toContain('stroke-sky-400');
    });

    it('renders OutputOrderStrip and links tokens to nodes uniquely', () => {
      const struct = createTreeStructure('@10', {
        '@10': { val: 10, leftId: '@5', rightId: '@15', parentId: null },
        '@5': { val: 5, leftId: null, rightId: null, parentId: '@10' },
        '@15': { val: 15, leftId: null, rightId: null, parentId: '@10' },
      });
      const heap = {
        '@10': { kind: 'object' as const, type: 'TreeNode', fields: { val: { k: 'prim' as const, v: 10 } } },
        '@5': { kind: 'object' as const, type: 'TreeNode', fields: { val: { k: 'prim' as const, v: 5 } } },
        '@15': { kind: 'object' as const, type: 'TreeNode', fields: { val: { k: 'prim' as const, v: 15 } } },
      };

      const onHoverRef = vi.fn();
      const onClickRef = vi.fn();

      render(
        <TreeView
          structure={struct}
          heap={heap}
          stdout="5 10"
          onHoverRef={onHoverRef}
          onClickRef={onClickRef}
        />,
      );

      expect(screen.getByTestId('output-order-strip')).toBeInTheDocument();
      const token5 = screen.getByTestId('output-token-5');
      expect(token5).toBeInTheDocument();

      fireEvent.mouseEnter(token5);
      expect(onHoverRef).toHaveBeenCalledWith('@5');

      fireEvent.click(token5);
      expect(onClickRef).toHaveBeenCalledWith('@5');
    });

    it('toggles Check BST order and displays violation badges', () => {
      // Tree violating BST: 12 is on left subtree of 10
      const struct = createTreeStructure('@10', {
        '@10': { val: 10, leftId: '@12', rightId: null, parentId: null },
        '@12': { val: 12, leftId: null, rightId: null, parentId: '@10' },
      });
      const heap = {
        '@10': { kind: 'object' as const, type: 'TreeNode', fields: { val: { k: 'prim' as const, v: 10 } } },
        '@12': { kind: 'object' as const, type: 'TreeNode', fields: { val: { k: 'prim' as const, v: 12 } } },
      };

      render(<TreeView structure={struct} heap={heap} />);

      // Initially toggle is off -> no badge
      expect(screen.queryByTestId('bst-violation-badge')).toBeNull();

      // Click toggle
      const toggle = screen.getByTestId('bst-check-toggle');
      fireEvent.click(toggle);

      // Now badge is displayed
      expect(screen.getByTestId('bst-violation-badge')).toBeInTheDocument();
      expect(screen.getByTestId('bst-badge-12')).toBeInTheDocument();
    });

    it('highlights variable when tag is hovered', () => {
      const struct = createTreeStructure('@1', {
        '@1': { val: 42, leftId: null, rightId: null, parentId: null },
      }, {
        entryPoints: [{ label: 'curr', target: '@1', source: 'local' }],
      });
      const heap = {
        '@1': {
          kind: 'object' as const,
          type: 'TreeNode',
          fields: { val: { k: 'prim' as const, v: 42 } },
        },
      };

      const onHoverVariable = vi.fn();
      render(<TreeView structure={struct} heap={heap} onHoverVariable={onHoverVariable} />);

      const tag = screen.getByTestId('tag-curr');
      fireEvent.mouseEnter(tag);
      expect(onHoverVariable).toHaveBeenCalledWith('curr');

      fireEvent.mouseLeave(tag);
      expect(onHoverVariable).toHaveBeenCalledWith(null);
    });
  });
});
