import { describe, it, expect } from 'vitest';
import {
  getHeapNodeLevel,
  getHeapNodeOffsetInLevel,
  computeHeapNodePosition,
  computeHeapTreeLayout,
  isNodeOverlapping,
} from '../heapLayout';

describe('heapLayout pure functions', () => {
  it('correctly computes levels and offsets for indexes', () => {
    // Level 0: [0] (1 node)
    expect(getHeapNodeLevel(0)).toBe(0);
    expect(getHeapNodeOffsetInLevel(0)).toBe(0);

    // Level 1: [1, 2] (2 nodes)
    expect(getHeapNodeLevel(1)).toBe(1);
    expect(getHeapNodeOffsetInLevel(1)).toBe(0);
    expect(getHeapNodeLevel(2)).toBe(1);
    expect(getHeapNodeOffsetInLevel(2)).toBe(1);

    // Level 2: [3..6] (4 nodes)
    expect(getHeapNodeLevel(3)).toBe(2);
    expect(getHeapNodeOffsetInLevel(3)).toBe(0);
    expect(getHeapNodeLevel(6)).toBe(2);
    expect(getHeapNodeOffsetInLevel(6)).toBe(3);

    // Level 3: [7..14] (8 nodes)
    expect(getHeapNodeLevel(7)).toBe(3);
    expect(getHeapNodeOffsetInLevel(7)).toBe(0);
    expect(getHeapNodeLevel(14)).toBe(3);
    expect(getHeapNodeOffsetInLevel(14)).toBe(7);

    // Level 4: [15..30] (16 nodes)
    expect(getHeapNodeLevel(15)).toBe(4);
    expect(getHeapNodeOffsetInLevel(15)).toBe(0);
    expect(getHeapNodeLevel(30)).toBe(4);
    expect(getHeapNodeOffsetInLevel(30)).toBe(15);

    // Level 5: [31..62] (32 nodes)
    expect(getHeapNodeLevel(31)).toBe(5);
    expect(getHeapNodeOffsetInLevel(31)).toBe(0);
    expect(getHeapNodeLevel(62)).toBe(5);
    expect(getHeapNodeOffsetInLevel(62)).toBe(31);

    // Level 6: [63..]
    expect(getHeapNodeLevel(63)).toBe(6);
    expect(getHeapNodeOffsetInLevel(63)).toBe(0);
  });

  it('guarantees deterministic, index-only positions independent of total heap size', () => {
    // Compute positions for size 3, size 15, size 31, and size 63
    const layout3 = computeHeapTreeLayout(3);
    const layout15 = computeHeapTreeLayout(15);
    const layout31 = computeHeapTreeLayout(31);
    const layout63 = computeHeapTreeLayout(63);

    // Node 0 must have the exact same (x, y) coordinates across all layouts
    expect(layout3.nodes[0].x).toBe(layout15.nodes[0].x);
    expect(layout3.nodes[0].y).toBe(layout15.nodes[0].y);
    expect(layout15.nodes[0].x).toBe(layout31.nodes[0].x);
    expect(layout31.nodes[0].x).toBe(layout63.nodes[0].x);

    // Node 2 must have the exact same (x, y) coordinates
    expect(layout3.nodes[2].x).toBe(layout15.nodes[2].x);
    expect(layout3.nodes[2].y).toBe(layout15.nodes[2].y);
    expect(layout15.nodes[2].x).toBe(layout63.nodes[2].x);

    // Node 14 must have the exact same (x, y) coordinates in layout 15, 31, 63
    expect(layout15.nodes[14].x).toBe(layout31.nodes[14].x);
    expect(layout15.nodes[14].y).toBe(layout31.nodes[14].y);
    expect(layout31.nodes[14].x).toBe(layout63.nodes[14].x);

    // Directly computing position for index 14 matches layout node
    const standaloneNode14 = computeHeapNodePosition(14);
    expect(standaloneNode14.x).toBe(layout63.nodes[14].x);
    expect(standaloneNode14.y).toBe(layout63.nodes[14].y);
  });

  it('places parent node x exactly halfway between its left and right children', () => {
    const layout = computeHeapTreeLayout(31);

    // Check parent = 0 (children 1 and 2)
    const p0 = layout.nodes[0];
    const c1 = layout.nodes[1];
    const c2 = layout.nodes[2];
    expect(p0.x).toBeCloseTo((c1.x + c2.x) / 2, 5);

    // Check parent = 1 (children 3 and 4)
    const p1 = layout.nodes[1];
    const c3 = layout.nodes[3];
    const c4 = layout.nodes[4];
    expect(p1.x).toBeCloseTo((c3.x + c4.x) / 2, 5);

    // Check parent = 2 (children 5 and 6)
    const p2 = layout.nodes[2];
    const c5 = layout.nodes[5];
    const c6 = layout.nodes[6];
    expect(p2.x).toBeCloseTo((c5.x + c6.x) / 2, 5);

    // Check parents across all nodes with both children
    for (let p = 0; p < 15; p++) {
      const left = 2 * p + 1;
      const right = 2 * p + 2;
      const parentNode = layout.nodes[p];
      const leftNode = layout.nodes[left];
      const rightNode = layout.nodes[right];
      expect(parentNode.x).toBeCloseTo((leftNode.x + rightNode.x) / 2, 5);
    }
  });

  it('guarantees NO node overlap for all sizes from 0 to 63', () => {
    // Generate layout for max size 63 (covers levels 0, 1, 2, 3, 4, 5)
    const layout = computeHeapTreeLayout(63);
    expect(layout.nodes).toHaveLength(63);

    for (let i = 0; i < layout.nodes.length; i++) {
      for (let j = i + 1; j < layout.nodes.length; j++) {
        const nodeA = layout.nodes[i];
        const nodeB = layout.nodes[j];

        const overlap = isNodeOverlapping(nodeA, nodeB);
        expect(overlap).toBe(false);

        // Distance should strictly exceed 2 * radius
        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        expect(dist).toBeGreaterThanOrEqual(nodeA.radius + nodeB.radius);
      }
    }
  });

  it('generates correct parent-child edges and bounds for complete binary tree', () => {
    const emptyLayout = computeHeapTreeLayout(0);
    expect(emptyLayout.nodes).toHaveLength(0);
    expect(emptyLayout.edges).toHaveLength(0);

    const singleLayout = computeHeapTreeLayout(1);
    expect(singleLayout.nodes).toHaveLength(1);
    expect(singleLayout.edges).toHaveLength(0);

    const layout7 = computeHeapTreeLayout(7);
    expect(layout7.nodes).toHaveLength(7);
    expect(layout7.edges).toHaveLength(6);

    // Verify edge connections: (0, 1), (0, 2), (1, 3), (1, 4), (2, 5), (2, 6)
    expect(layout7.edges[0]).toMatchObject({ parentIndex: 0, childIndex: 1, isLeft: true });
    expect(layout7.edges[1]).toMatchObject({ parentIndex: 0, childIndex: 2, isLeft: false });
    expect(layout7.edges[2]).toMatchObject({ parentIndex: 1, childIndex: 3, isLeft: true });
    expect(layout7.edges[3]).toMatchObject({ parentIndex: 1, childIndex: 4, isLeft: false });
    expect(layout7.edges[4]).toMatchObject({ parentIndex: 2, childIndex: 5, isLeft: true });
    expect(layout7.edges[5]).toMatchObject({ parentIndex: 2, childIndex: 6, isLeft: false });

    // Bounds are positive and encompass all nodes
    expect(layout7.bounds.width).toBeGreaterThan(0);
    expect(layout7.bounds.height).toBeGreaterThan(0);
    expect(layout7.bounds.maxX).toBeGreaterThan(layout7.bounds.minX);
  });
});
