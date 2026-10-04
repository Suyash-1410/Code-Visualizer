import { describe, it, expect } from 'vitest';
import {
  computeTreeLayout,
  computeMultiTreeLayout,
  checkTreeOverlap,
} from '../layout';
import type { BinaryTreeStructure } from '../../../recognition/types';
import type { HeapObject, Value } from '../../../trace/types';

// Helper to construct a synthetic BinaryTreeStructure
function createTreeStructure(
  rootId: string | null,
  nodes: Record<
    string,
    { val: Value; leftId: string | null; rightId: string | null; parentId?: string | null }
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
          val: n.val,
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

// Helper to create synthetic heap
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

describe('Tree Layout Engine (Phase 3 Stage 3)', () => {
  // -------------------------------------------------------------------------
  // 1. Positional Meaning of Left and Right
  // -------------------------------------------------------------------------
  describe('Positional Meaning of Left and Right', () => {
    it('Left-only node: child is positioned strictly to the left of the parent (child.x < parent.x)', () => {
      const struct = createTreeStructure('@1', {
        '@1': { val: { k: 'prim', t: 'int', v: 10 }, leftId: '@2', rightId: null },
        '@2': { val: { k: 'prim', t: 'int', v: 5 }, leftId: null, rightId: null },
      });
      const heap = createHeap({
        '@1': { val: 10, leftId: '@2', rightId: null },
        '@2': { val: 5, leftId: null, rightId: null },
      });

      const layout = computeTreeLayout(struct, heap);
      const parent = layout.nodes.find((n) => n.id === '@1')!;
      const leftChild = layout.nodes.find((n) => n.id === '@2')!;

      expect(parent).toBeDefined();
      expect(leftChild).toBeDefined();
      expect(leftChild.x).toBeLessThan(parent.x);
      expect(leftChild.y).toBeGreaterThan(parent.y);
      expect(checkTreeOverlap(layout)).toBe(true);
    });

    it('Right-only node: child is positioned strictly to the right of the parent (child.x > parent.x)', () => {
      const struct = createTreeStructure('@1', {
        '@1': { val: { k: 'prim', t: 'int', v: 10 }, leftId: null, rightId: '@3' },
        '@3': { val: { k: 'prim', t: 'int', v: 15 }, leftId: null, rightId: null },
      });
      const heap = createHeap({
        '@1': { val: 10, leftId: null, rightId: '@3' },
        '@3': { val: 15, leftId: null, rightId: null },
      });

      const layout = computeTreeLayout(struct, heap);
      const parent = layout.nodes.find((n) => n.id === '@1')!;
      const rightChild = layout.nodes.find((n) => n.id === '@3')!;

      expect(parent).toBeDefined();
      expect(rightChild).toBeDefined();
      expect(rightChild.x).toBeGreaterThan(parent.x);
      expect(rightChild.y).toBeGreaterThan(parent.y);
      expect(checkTreeOverlap(layout)).toBe(true);
    });

    it('Two-child node: parent is horizontally centered between left and right children', () => {
      const struct = createTreeStructure('@1', {
        '@1': { val: { k: 'prim', t: 'int', v: 10 }, leftId: '@2', rightId: '@3' },
        '@2': { val: { k: 'prim', t: 'int', v: 5 }, leftId: null, rightId: null },
        '@3': { val: { k: 'prim', t: 'int', v: 15 }, leftId: null, rightId: null },
      });
      const heap = createHeap({
        '@1': { val: 10, leftId: '@2', rightId: '@3' },
        '@2': { val: 5, leftId: null, rightId: null },
        '@3': { val: 15, leftId: null, rightId: null },
      });

      const layout = computeTreeLayout(struct, heap);
      const parent = layout.nodes.find((n) => n.id === '@1')!;
      const leftChild = layout.nodes.find((n) => n.id === '@2')!;
      const rightChild = layout.nodes.find((n) => n.id === '@3')!;

      expect(leftChild.x).toBeLessThan(parent.x);
      expect(rightChild.x).toBeGreaterThan(parent.x);
      expect(parent.x).toBeCloseTo((leftChild.x + rightChild.x) / 2, 4);
      expect(checkTreeOverlap(layout)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 2. Overlap Prevention & Centering Across Many Tree Shapes
  // -------------------------------------------------------------------------
  describe('Overlap Prevention & Subtree Contours', () => {
    it('Zig-zag tree (left-right alternating) never overlaps', () => {
      // 10 -> L: 5 -> R: 7 -> L: 6
      const struct = createTreeStructure('@1', {
        '@1': { val: { k: 'prim', t: 'int', v: 10 }, leftId: '@2', rightId: null },
        '@2': { val: { k: 'prim', t: 'int', v: 5 }, leftId: null, rightId: '@3' },
        '@3': { val: { k: 'prim', t: 'int', v: 7 }, leftId: '@4', rightId: null },
        '@4': { val: { k: 'prim', t: 'int', v: 6 }, leftId: null, rightId: null },
      });
      const heap = createHeap({
        '@1': { val: 10, leftId: '@2', rightId: null },
        '@2': { val: 5, leftId: null, rightId: '@3' },
        '@3': { val: 7, leftId: '@4', rightId: null },
        '@4': { val: 6, leftId: null, rightId: null },
      });

      const layout = computeTreeLayout(struct, heap);
      expect(layout.nodes.length).toBe(4);
      expect(checkTreeOverlap(layout)).toBe(true);
    });

    it('Property test: randomly generated trees never have overlapping nodes', () => {
      // Generate 20 randomized binary trees with 7 to 20 nodes
      for (let trial = 0; trial < 20; trial++) {
        const nodeCount = 7 + (trial % 14);
        const nodeMap: Record<
          string,
          { val: Value; leftId: string | null; rightId: string | null }
        > = {};
        const heapMap: Record<
          string,
          { val: number; leftId: string | null; rightId: string | null }
        > = {};

        // Build a random BST
        const ids = Array.from({ length: nodeCount }, (_, i) => `@${i + 1}`);
        const values = ids.map((_, i) => (i + 1) * 10);
        // Shuffle values
        values.sort(() => (trial * 37 + 13) % 2 - 0.5);

        interface BSTNode {
          id: string;
          val: number;
          left: BSTNode | null;
          right: BSTNode | null;
        }

        let bstRoot: BSTNode | null = null;

        function insertBST(root: BSTNode | null, id: string, val: number): BSTNode {
          if (!root) return { id, val, left: null, right: null };
          if (val < root.val) {
            root.left = insertBST(root.left, id, val);
          } else {
            root.right = insertBST(root.right, id, val);
          }
          return root;
        }

        for (let i = 0; i < nodeCount; i++) {
          bstRoot = insertBST(bstRoot, ids[i], values[i]);
        }

        function flattenBST(node: BSTNode | null) {
          if (!node) return;
          nodeMap[node.id] = {
            val: { k: 'prim', t: 'int', v: node.val },
            leftId: node.left ? node.left.id : null,
            rightId: node.right ? node.right.id : null,
          };
          heapMap[node.id] = {
            val: node.val,
            leftId: node.left ? node.left.id : null,
            rightId: node.right ? node.right.id : null,
          };
          flattenBST(node.left);
          flattenBST(node.right);
        }

        flattenBST(bstRoot);

        const struct = createTreeStructure(bstRoot!.id, nodeMap);
        const heap = createHeap(heapMap);

        const layout = computeTreeLayout(struct, heap);
        expect(layout.nodes.length).toBe(nodeCount);
        expect(checkTreeOverlap(layout)).toBe(true);
      }
    });
  });

  // -------------------------------------------------------------------------
  // 3. Degenerate Skewed Trees (15 to 40 nodes)
  // -------------------------------------------------------------------------
  describe('Skewed Trees', () => {
    it('SkewedLeft (15 nodes): strictly moves left at every step with no overlap', () => {
      const nodeMap: Record<
        string,
        { val: Value; leftId: string | null; rightId: string | null }
      > = {};
      const heapMap: Record<
        string,
        { val: number; leftId: string | null; rightId: string | null }
      > = {};

      for (let i = 1; i <= 15; i++) {
        const id = `@${i}`;
        const nextId = i < 15 ? `@${i + 1}` : null;
        nodeMap[id] = {
          val: { k: 'prim', t: 'int', v: 16 - i },
          leftId: nextId,
          rightId: null,
        };
        heapMap[id] = {
          val: 16 - i,
          leftId: nextId,
          rightId: null,
        };
      }

      const struct = createTreeStructure('@1', nodeMap);
      const heap = createHeap(heapMap);

      const layout = computeTreeLayout(struct, heap);
      expect(layout.nodes.length).toBe(15);
      expect(checkTreeOverlap(layout)).toBe(true);

      for (let i = 1; i < 15; i++) {
        const parent = layout.nodes.find((n) => n.id === `@${i}`)!;
        const child = layout.nodes.find((n) => n.id === `@${i + 1}`)!;
        expect(child.x).toBeLessThan(parent.x);
        expect(child.y).toBeGreaterThan(parent.y);
      }
    });

    it('SkewedRight (15 nodes): strictly moves right at every step with no overlap', () => {
      const nodeMap: Record<
        string,
        { val: Value; leftId: string | null; rightId: string | null }
      > = {};
      const heapMap: Record<
        string,
        { val: number; leftId: string | null; rightId: string | null }
      > = {};

      for (let i = 1; i <= 15; i++) {
        const id = `@${i}`;
        const nextId = i < 15 ? `@${i + 1}` : null;
        nodeMap[id] = {
          val: { k: 'prim', t: 'int', v: i },
          leftId: null,
          rightId: nextId,
        };
        heapMap[id] = {
          val: i,
          leftId: null,
          rightId: nextId,
        };
      }

      const struct = createTreeStructure('@1', nodeMap);
      const heap = createHeap(heapMap);

      const layout = computeTreeLayout(struct, heap);
      expect(layout.nodes.length).toBe(15);
      expect(checkTreeOverlap(layout)).toBe(true);

      for (let i = 1; i < 15; i++) {
        const parent = layout.nodes.find((n) => n.id === `@${i}`)!;
        const child = layout.nodes.find((n) => n.id === `@${i + 1}`)!;
        expect(child.x).toBeGreaterThan(parent.x);
        expect(child.y).toBeGreaterThan(parent.y);
      }
    });

    it('Deep skewed tree (40 nodes) computes layout without error or overlap', () => {
      const nodeMap: Record<
        string,
        { val: Value; leftId: string | null; rightId: string | null }
      > = {};
      const heapMap: Record<
        string,
        { val: number; leftId: string | null; rightId: string | null }
      > = {};

      for (let i = 1; i <= 40; i++) {
        const id = `@${i}`;
        const nextId = i < 40 ? `@${i + 1}` : null;
        nodeMap[id] = {
          val: { k: 'prim', t: 'int', v: i },
          leftId: i % 2 === 1 ? nextId : null,
          rightId: i % 2 === 0 ? nextId : null,
        };
        heapMap[id] = {
          val: i,
          leftId: i % 2 === 1 ? nextId : null,
          rightId: i % 2 === 0 ? nextId : null,
        };
      }

      const struct = createTreeStructure('@1', nodeMap);
      const heap = createHeap(heapMap);

      const layout = computeTreeLayout(struct, heap);
      expect(layout.nodes.length).toBe(40);
      expect(checkTreeOverlap(layout)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Complete / Full Trees (up to 31 nodes)
  // -------------------------------------------------------------------------
  describe('Complete Trees', () => {
    it('FullTree15 (15 nodes, 4 levels): completely symmetric, no overlap', () => {
      // Binary heap index representation: 1 is root, 2*i is left, 2*i+1 is right
      const nodeMap: Record<
        string,
        { val: Value; leftId: string | null; rightId: string | null }
      > = {};
      const heapMap: Record<
        string,
        { val: number; leftId: string | null; rightId: string | null }
      > = {};

      for (let i = 1; i <= 15; i++) {
        const id = `@${i}`;
        const leftId = 2 * i <= 15 ? `@${2 * i}` : null;
        const rightId = 2 * i + 1 <= 15 ? `@${2 * i + 1}` : null;
        nodeMap[id] = {
          val: { k: 'prim', t: 'int', v: i },
          leftId,
          rightId,
        };
        heapMap[id] = {
          val: i,
          leftId,
          rightId,
        };
      }

      const struct = createTreeStructure('@1', nodeMap);
      const heap = createHeap(heapMap);

      const layout = computeTreeLayout(struct, heap);
      expect(layout.nodes.length).toBe(15);
      expect(checkTreeOverlap(layout)).toBe(true);

      // Verify symmetry around root
      const root = layout.nodes.find((n) => n.id === '@1')!;
      const leftChild = layout.nodes.find((n) => n.id === '@2')!;
      const rightChild = layout.nodes.find((n) => n.id === '@3')!;

      expect(root.x - leftChild.x).toBeCloseTo(rightChild.x - root.x, 2);
    });

    it('Complete tree of 31 nodes (5 levels): computes symmetric tidy layout without overlap', () => {
      const nodeMap: Record<
        string,
        { val: Value; leftId: string | null; rightId: string | null }
      > = {};
      const heapMap: Record<
        string,
        { val: number; leftId: string | null; rightId: string | null }
      > = {};

      for (let i = 1; i <= 31; i++) {
        const id = `@${i}`;
        const leftId = 2 * i <= 31 ? `@${2 * i}` : null;
        const rightId = 2 * i + 1 <= 31 ? `@${2 * i + 1}` : null;
        nodeMap[id] = {
          val: { k: 'prim', t: 'int', v: i },
          leftId,
          rightId,
        };
        heapMap[id] = {
          val: i,
          leftId,
          rightId,
        };
      }

      const struct = createTreeStructure('@1', nodeMap);
      const heap = createHeap(heapMap);

      const layout = computeTreeLayout(struct, heap);
      expect(layout.nodes.length).toBe(31);
      expect(checkTreeOverlap(layout)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Determinism & Edge Cases (Empty, Single)
  // -------------------------------------------------------------------------
  describe('Determinism and Special Tree States', () => {
    it('Determinism: running layout on identical input produces identical coordinates', () => {
      const struct = createTreeStructure('@1', {
        '@1': { val: { k: 'prim', t: 'int', v: 50 }, leftId: '@2', rightId: '@3' },
        '@2': { val: { k: 'prim', t: 'int', v: 30 }, leftId: '@4', rightId: null },
        '@3': { val: { k: 'prim', t: 'int', v: 70 }, leftId: null, rightId: '@5' },
        '@4': { val: { k: 'prim', t: 'int', v: 20 }, leftId: null, rightId: null },
        '@5': { val: { k: 'prim', t: 'int', v: 90 }, leftId: null, rightId: null },
      });
      const heap = createHeap({
        '@1': { val: 50, leftId: '@2', rightId: '@3' },
        '@2': { val: 30, leftId: '@4', rightId: null },
        '@3': { val: 70, leftId: null, rightId: '@5' },
        '@4': { val: 20, leftId: null, rightId: null },
        '@5': { val: 90, leftId: null, rightId: null },
      });

      const layout1 = computeTreeLayout(struct, heap);
      const layout2 = computeTreeLayout(struct, heap);

      expect(layout1.nodes.length).toBe(layout2.nodes.length);
      for (let i = 0; i < layout1.nodes.length; i++) {
        expect(layout1.nodes[i].x).toBe(layout2.nodes[i].x);
        expect(layout1.nodes[i].y).toBe(layout2.nodes[i].y);
      }
    });

    it('Empty tree: produces 0 nodes and records null entry points', () => {
      const struct = createTreeStructure(null, {});
      const heap: Record<string, HeapObject> = {};

      const layout = computeTreeLayout(struct, heap);
      expect(layout.nodes.length).toBe(0);
      expect(layout.edges.length).toBe(0);
      expect(layout.nullTags.length).toBe(1);
      expect(layout.nullTags[0].label).toBe('root');
      expect(layout.bounds.width).toBeGreaterThan(0);
    });

    it('Single node tree: produces 1 node and correct bounds', () => {
      const struct = createTreeStructure('@1', {
        '@1': { val: { k: 'prim', t: 'int', v: 42 }, leftId: null, rightId: null },
      });
      const heap = createHeap({
        '@1': { val: 42, leftId: null, rightId: null },
      });

      const layout = computeTreeLayout(struct, heap);
      expect(layout.nodes.length).toBe(1);
      expect(layout.edges.length).toBe(0);
      expect(layout.nodes[0].valString).toBe('42');
    });

    it('Null stubs toggle: generates null stubs when showNullChildren is true', () => {
      const struct = createTreeStructure('@1', {
        '@1': { val: { k: 'prim', t: 'int', v: 10 }, leftId: '@2', rightId: null },
        '@2': { val: { k: 'prim', t: 'int', v: 5 }, leftId: null, rightId: null },
      });
      const heap = createHeap({
        '@1': { val: 10, leftId: '@2', rightId: null },
        '@2': { val: 5, leftId: null, rightId: null },
      });

      // Default: showNullChildren = false
      const layoutWithoutStubs = computeTreeLayout(struct, heap, { showNullChildren: false });
      expect(layoutWithoutStubs.nodes.every((n) => !n.isNullStub)).toBe(true);

      // Enabled: showNullChildren = true
      const layoutWithStubs = computeTreeLayout(struct, heap, { showNullChildren: true });
      const stubs = layoutWithStubs.nodes.filter((n) => n.isNullStub);
      expect(stubs.length).toBeGreaterThan(0);
      expect(layoutWithStubs.edges.some((e) => e.kind === 'nullStub')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Multiple Trees Side by Side
  // -------------------------------------------------------------------------
  describe('Multiple Trees Side by Side', () => {
    it('lays out two separate trees side by side with gap and no overlap', () => {
      const tree1 = createTreeStructure('@1', {
        '@1': { val: { k: 'prim', t: 'int', v: 10 }, leftId: '@2', rightId: null },
        '@2': { val: { k: 'prim', t: 'int', v: 5 }, leftId: null, rightId: null },
      });
      const tree2 = createTreeStructure('@10', {
        '@10': { val: { k: 'prim', t: 'int', v: 100 }, leftId: null, rightId: '@11' },
        '@11': { val: { k: 'prim', t: 'int', v: 150 }, leftId: null, rightId: null },
      });

      const heap = createHeap({
        '@1': { val: 10, leftId: '@2', rightId: null },
        '@2': { val: 5, leftId: null, rightId: null },
        '@10': { val: 100, leftId: null, rightId: '@11' },
        '@11': { val: 150, leftId: null, rightId: null },
      });

      const multi = computeMultiTreeLayout([tree1, tree2], heap);
      expect(multi.trees.length).toBe(2);

      const l1 = multi.trees[0];
      const l2 = multi.trees[1];

      expect(l2.bounds.minX).toBeGreaterThanOrEqual(l1.bounds.maxX + 40);
      expect(checkTreeOverlap(l1)).toBe(true);
      expect(checkTreeOverlap(l2)).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Cycles and Shared Subtrees Warning Badges
  // -------------------------------------------------------------------------
  describe('Cycle and Shared Node Safety Badges', () => {
    it('sets warning badge and broken edge for cycle without hanging', () => {
      const struct = createTreeStructure(
        '@1',
        {
          '@1': { val: { k: 'prim', t: 'int', v: 10 }, leftId: '@2', rightId: null },
          '@2': { val: { k: 'prim', t: 'int', v: 20 }, leftId: null, rightId: null },
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

      const layout = computeTreeLayout(struct, heap);
      expect(layout.hasCycle).toBe(true);
      expect(layout.warningBadge).toContain('Cycle detected');
      expect(layout.edges.some((e) => e.isBroken)).toBe(true);
    });

    it('sets warning badge and broken edge for shared node DAG without hanging', () => {
      const struct = createTreeStructure(
        '@1',
        {
          '@1': { val: { k: 'prim', t: 'int', v: 10 }, leftId: '@3', rightId: '@2' },
          '@2': { val: { k: 'prim', t: 'int', v: 20 }, leftId: null, rightId: null },
          '@3': { val: { k: 'prim', t: 'int', v: 30 }, leftId: null, rightId: null },
        },
        {
          hasSharedNode: true,
          confidence: 'low',
          brokenEdges: [{ fromId: '@2', toId: '@3', childSide: 'left', reason: 'shared' }],
        },
      );
      const heap = createHeap({
        '@1': { val: 10, leftId: '@3', rightId: '@2' },
        '@2': { val: 20, leftId: null, rightId: null },
        '@3': { val: 30, leftId: null, rightId: null },
      });

      const layout = computeTreeLayout(struct, heap);
      expect(layout.hasSharedNode).toBe(true);
      expect(layout.warningBadge).toContain('Shared node detected');
      expect(layout.edges.some((e) => e.isBroken)).toBe(true);
    });
  });
});
