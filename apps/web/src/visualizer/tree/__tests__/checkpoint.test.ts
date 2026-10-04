import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { recognize } from '../../../recognition';
import { computeTreeLayout, checkTreeOverlap } from '../layout';
import type { Trace } from '../../../trace/types';

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

describe('Stage 3 Checkpoint Inspections', () => {
  it('Checkpoint 1: FullTree15 is compact, 4-level, and perfectly symmetric', () => {
    const trace = loadFixture('FullTree15.json');
    const step = trace.steps[trace.steps.length - 2];
    const res = recognize(step);

    expect(res.trees.length).toBe(1);
    const tree = res.trees[0];
    expect(tree.nodeCount).toBe(15);
    expect(tree.height).toBe(4);

    const layout = computeTreeLayout(tree, step.heap);
    expect(layout.nodes.length).toBe(15);
    expect(checkTreeOverlap(layout)).toBe(true);

    const root = layout.nodes.find((n) => n.id === tree.rootId)!;
    const leftChild = layout.nodes.find((n) => n.id === root.leftId)!;
    const rightChild = layout.nodes.find((n) => n.id === root.rightId)!;

    // Symmetry around root
    const leftDist = root.x - leftChild.x;
    const rightDist = rightChild.x - root.x;
    expect(leftDist).toBeCloseTo(rightDist, 2);

    console.log(`[FullTree15 Checkpoint] Nodes: ${layout.nodes.length}, Bounds: ${layout.bounds.width.toFixed(0)}x${layout.bounds.height.toFixed(0)}, Root X: ${root.x}, Symmetry diff: ${Math.abs(leftDist - rightDist)}`);
  });

  it('Checkpoint 2: SkewedLeft has all 15 nodes descending strictly to the left with zero overlap', () => {
    const trace = loadFixture('SkewedLeft.json');
    const step = trace.steps[trace.steps.length - 2];
    const res = recognize(step);

    expect(res.trees.length).toBe(1);
    const tree = res.trees[0];
    expect(tree.nodeCount).toBe(15);

    const layout = computeTreeLayout(tree, step.heap);
    expect(layout.nodes.length).toBe(15);
    expect(checkTreeOverlap(layout)).toBe(true);

    // Verify monotonic descending to the left
    let curr = layout.nodes.find((n) => n.id === tree.rootId)!;
    while (curr.leftId) {
      const next = layout.nodes.find((n) => n.id === curr.leftId)!;
      expect(next.x).toBeLessThan(curr.x);
      expect(next.y).toBeGreaterThan(curr.y);
      curr = next;
    }

    console.log(`[SkewedLeft Checkpoint] Nodes: ${layout.nodes.length}, Bounds: ${layout.bounds.width.toFixed(0)}x${layout.bounds.height.toFixed(0)}, Strictly left descending: true, Overlap: none`);
  });

  it('Checkpoint 3: LeftOnly positions the lone child strictly to the left of parent', () => {
    const trace = loadFixture('LeftOnly.json');
    const step = trace.steps[trace.steps.length - 2];
    const res = recognize(step);

    expect(res.trees.length).toBe(1);
    const tree = res.trees[0];
    expect(tree.nodeCount).toBe(2);

    const layout = computeTreeLayout(tree, step.heap);
    const root = layout.nodes.find((n) => n.id === tree.rootId)!;
    const leftChild = layout.nodes.find((n) => n.id === root.leftId)!;

    expect(leftChild.x).toBeLessThan(root.x);
    expect(leftChild.y).toBeGreaterThan(root.y);
    expect(checkTreeOverlap(layout)).toBe(true);

    console.log(`[LeftOnly Checkpoint] Root (${root.valString}) at x=${root.x}, Child (${leftChild.valString}) at x=${leftChild.x} (left displacement: ${root.x - leftChild.x}px)`);
  });

  it('Checkpoint 4: ParentPointerTree recognizes parent as back-reference without drawing parent arrow', () => {
    const trace = loadFixture('ParentPointerTree.json');
    const step = trace.steps[trace.steps.length - 2];
    const res = recognize(step);

    expect(res.trees.length).toBe(1);
    const tree = res.trees[0];
    expect(tree.parentField).toBe('parent');

    const layout = computeTreeLayout(tree, step.heap);
    // Only parent-to-child edges exist in layout.edges; NO parent arrows
    expect(layout.edges.length).toBe(2);
    expect(layout.edges.every((e) => e.kind === 'left' || e.kind === 'right')).toBe(true);

    const root = layout.nodes.find((n) => n.id === tree.rootId)!;
    const leftChild = layout.nodes.find((n) => n.id === root.leftId)!;
    expect(leftChild.parentId).toBe(root.id);

    console.log(`[ParentPointerTree Checkpoint] Recognized parentField: "${tree.parentField}", Edges drawn: ${layout.edges.length} (strictly parent-to-child lines behind nodes)`);
  });

  it('Checkpoint 5: ThreeChildFields falls back to generic ObjectView', () => {
    const trace = loadFixture('ThreeChildFields.json');
    const step = trace.steps[trace.steps.length - 2];
    const res = recognize(step);

    // Must NOT be recognized as binary tree
    expect(res.trees.length).toBe(0);
    // Must remain in leftover objects for generic ObjectView
    expect(res.leftoverObjectIds.length).toBeGreaterThan(0);

    console.log(`[ThreeChildFields Checkpoint] Trees: ${res.trees.length}, Leftover Generic Objects: ${res.leftoverObjectIds.length}`);
  });

  it('Checkpoint 6: BrokenCycleTree terminates normally, sets warning badge, and isolates back-edge', () => {
    const trace = loadFixture('BrokenCycleTree.json');
    const step = trace.steps[trace.steps.length - 2];
    const res = recognize(step);

    expect(res.trees.length).toBe(1);
    const tree = res.trees[0];
    expect(tree.hasCycle).toBe(true);
    expect(tree.confidence).toBe('low');
    expect(tree.brokenEdges.length).toBe(1);

    const layout = computeTreeLayout(tree, step.heap);
    expect(layout.hasCycle).toBe(true);
    expect(layout.warningBadge).toContain('Cycle detected');
    expect(layout.edges.some((e) => e.isBroken)).toBe(true);

    console.log(`[BrokenCycleTree Checkpoint] Trace completed in ${trace.steps.length} steps, Cycle detected: ${layout.hasCycle}, Warning badge: "${layout.warningBadge}", Broken edges: ${layout.edges.filter(e => e.isBroken).length}`);
  });

  it('Checkpoint 7: BST mid-insert (BstInsertRecursive) displays partially formed BST with active tags', () => {
    const trace = loadFixture('bst-insert-recursive-trace.json');
    // Pick an intermediate step mid-way through tree building
    const midStep = trace.steps[Math.floor(trace.steps.length / 2)];
    const res = recognize(midStep);

    expect(res.trees.length).toBe(1);
    const tree = res.trees[0];
    expect(tree.nodeCount).toBeGreaterThanOrEqual(2);

    const layout = computeTreeLayout(tree, midStep.heap);
    expect(checkTreeOverlap(layout)).toBe(true);
    expect(layout.tags.length).toBeGreaterThan(0);

    console.log(`[BST Mid-Insert Checkpoint] Step ${midStep.i}/${trace.steps.length}, Node count: ${layout.nodes.length}, Edges: ${layout.edges.length}, Tags attached: ${layout.tags.map(t => t.label).join(', ')}, Overlap: none`);
  });
});
