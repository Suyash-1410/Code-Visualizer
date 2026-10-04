import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { recognize } from '../../../recognition';
import { computeTreeLayout, type TreeLayoutResult } from '../layout';
import { computeTreeDiff } from '../treeDiff';
import type { Trace, Step, Value, HeapObject } from '../../../trace/types';
import type { BinaryTreeStructure } from '../../../recognition/types';

describe('Tree Animations, Diffing, and Layout Stability (Phase 3 Stage 4)', () => {
  const tracesDir = path.resolve(__dirname, '../../../../../../tests/fixtures/traces');

  function loadTrace(name: string): Trace {
    const file = path.join(tracesDir, `${name}.json`);
    const content = fs.readFileSync(file, 'utf-8');
    return JSON.parse(content) as Trace;
  }

  it('measures average and maximum node displacement on BstInsertRecursive', () => {
    const trace = loadTrace('BstInsertRecursive');
    expect(trace.steps.length).toBeGreaterThan(50);

    let prevLayout: TreeLayoutResult | undefined = undefined;
    let prevTree: BinaryTreeStructure | undefined = undefined;
    let prevStep: Step | undefined = undefined;

    let totalDisplacement = 0;
    let totalComparedNodes = 0;
    let maxDisplacement = 0;
    let insertStepsCount = 0;

    for (let i = 0; i < trace.steps.length; i++) {
      const step = trace.steps[i];
      const rec = recognize(step, undefined, new Map(), prevStep);
      const tree = rec.trees?.[0];

      if (!tree || tree.nodeCount === 0) {
        prevStep = step;
        continue;
      }

      const diff = prevTree
        ? computeTreeDiff(prevTree, tree, prevStep?.heap, step.heap)
        : undefined;

      const layout = computeTreeLayout(tree, step.heap, {
        prevLayout,
        diffResult: diff,
        ghostNodes: diff?.ghostNodes,
        nodeRadius: 22,
        levelHeight: 74,
        siblingGap: 28,
        startX: 40,
        startY: 40,
      });

      if (prevLayout && diff) {
        // Measure displacement of nodes that existed in both steps
        const prevNodeMap = new Map(prevLayout.nodes.map((n) => [n.id, n]));

        let stepDisplacementSum = 0;
        let stepComparedCount = 0;

        for (const currNode of layout.nodes) {
          if (currNode.isNullStub || currNode.isGhost) continue;
          const prevNode = prevNodeMap.get(currNode.id);
          if (prevNode && !prevNode.isNullStub && !prevNode.isGhost) {
            const dx = currNode.x - prevNode.x;
            const dy = currNode.y - prevNode.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            stepDisplacementSum += dist;
            stepComparedCount++;

            if (dist > maxDisplacement) {
              maxDisplacement = dist;
            }
          }
        }

        if (stepComparedCount > 0) {
          totalDisplacement += stepDisplacementSum;
          totalComparedNodes += stepComparedCount;
          insertStepsCount++;
        }
      }

      prevLayout = layout;
      prevTree = tree;
      prevStep = step;
    }

    const avgDisplacement =
      totalComparedNodes > 0 ? totalDisplacement / totalComparedNodes : 0;

    console.log(
      `[BstInsertRecursive Layout Stability] Steps: ${insertStepsCount}, Compared Nodes: ${totalComparedNodes}, Avg Displacement: ${avgDisplacement.toFixed(
        2,
      )}px, Max Displacement: ${maxDisplacement.toFixed(2)}px`,
    );

    // Assert that the layout is stable and doesn't jump wildly across inserts
    expect(avgDisplacement).toBeLessThan(15);
  });

  it('verifies rotation restructuring and edge rewirings on AvlRightRotate', () => {
    const trace = loadTrace('AvlRightRotate');
    let foundRewiredStep = false;

    let prevTree: BinaryTreeStructure | undefined = undefined;
    let prevStep: Step | undefined = undefined;

    for (let i = 0; i < trace.steps.length; i++) {
      const step = trace.steps[i];
      const rec = recognize(step, undefined, new Map(), prevStep);
      const tree = rec.trees?.[0];

      if (tree && prevTree && prevStep) {
        const diff = computeTreeDiff(prevTree, tree, prevStep.heap, step.heap);
        if (diff.changedEdgeIds.size > 0) {
          foundRewiredStep = true;
          // Check that rewired edges highlight
          const layout = computeTreeLayout(tree, step.heap, {
            diffResult: diff,
          });
          const changedEdge = layout.edges.find((e) => e.isChanged);
          expect(changedEdge).toBeDefined();
          break;
        }
      }

      prevTree = tree;
      prevStep = step;
    }

    expect(foundRewiredStep).toBe(true);
  });

  it('verifies rotation restructuring on AvlLeftRotate', () => {
    const trace = loadTrace('AvlLeftRotate');
    let foundRewiredStep = false;

    let prevTree: BinaryTreeStructure | undefined = undefined;
    let prevStep: Step | undefined = undefined;

    for (let i = 0; i < trace.steps.length; i++) {
      const step = trace.steps[i];
      const rec = recognize(step, undefined, new Map(), prevStep);
      const tree = rec.trees?.[0];

      if (tree && prevTree && prevStep) {
        const diff = computeTreeDiff(prevTree, tree, prevStep.heap, step.heap);
        if (diff.changedEdgeIds.size > 0) {
          foundRewiredStep = true;
          const layout = computeTreeLayout(tree, step.heap, {
            diffResult: diff,
          });
          const changedEdge = layout.edges.find((e) => e.isChanged);
          expect(changedEdge).toBeDefined();
          break;
        }
      }

      prevTree = tree;
      prevStep = step;
    }

    expect(foundRewiredStep).toBe(true);
  });

  it('verifies successor replacement and deletion restructuring on BstDeleteTwoChildren', () => {
    const trace = loadTrace('BstDeleteTwoChildren');
    let deletionObserved = false;

    let prevTree: BinaryTreeStructure | undefined = undefined;
    let prevStep: Step | undefined = undefined;

    for (let i = 0; i < trace.steps.length; i++) {
      const step = trace.steps[i];
      const rec = recognize(step, undefined, new Map(), prevStep);
      const tree = rec.trees?.[0];

      if (tree && prevTree && prevStep) {
        const diff = computeTreeDiff(prevTree, tree, prevStep.heap, step.heap);
        if (diff.removedNodes.size > 0 || diff.changedDataNodes.size > 0) {
          deletionObserved = true;
          const layout = computeTreeLayout(tree, step.heap, {
            diffResult: diff,
            ghostNodes: diff.ghostNodes,
          });
          expect(layout.nodes.length).toBeGreaterThan(0);
        }
      }

      prevTree = tree;
      prevStep = step;
    }

    expect(deletionObserved).toBe(true);
  });

  it('renders ghost nodes when a node is deleted in BstDeleteLeaf', () => {
    const trace = loadTrace('BstDeleteLeaf');
    let ghostNodeObserved = false;

    let prevTree: BinaryTreeStructure | undefined = undefined;
    let prevStep: Step | undefined = undefined;
    let prevLayout: TreeLayoutResult | undefined = undefined;

    for (let i = 0; i < trace.steps.length; i++) {
      const step = trace.steps[i];
      const rec = recognize(step, undefined, new Map(), prevStep);
      const tree = rec.trees?.[0];

      if (tree && prevTree && prevStep) {
        const diff = computeTreeDiff(prevTree, tree, prevStep.heap, step.heap, {
          showGhosts: true,
        });

        if (diff.ghostNodes.length > 0) {
          ghostNodeObserved = true;
          const layout = computeTreeLayout(tree, step.heap, {
            prevLayout,
            diffResult: diff,
            ghostNodes: diff.ghostNodes,
          });

          const ghost = layout.nodes.find((n) => n.isGhost);
          expect(ghost).toBeDefined();
          expect(ghost?.valString).toBe('20');
          break;
        }
      }

      if (tree) {
        prevLayout = computeTreeLayout(tree, step.heap);
      }
      prevTree = tree;
      prevStep = step;
    }

    expect(ghostNodeObserved).toBe(true);
  });

  it('measures layout calculation performance on a 31-node complete tree (< 5ms)', () => {
    // Generate a 31-node complete binary tree structure
    const allNodeIds: string[] = [];
    const nodesRecord: Record<string, { id: string; leftId: string | null; rightId: string | null; parentId: string | null; val: Value }> = {};
    const heapRecord: Record<string, HeapObject> = {};

    for (let i = 1; i <= 31; i++) {
      const id = `@${i}`;
      allNodeIds.push(id);
      const leftIndex = 2 * i;
      const rightIndex = 2 * i + 1;
      const parentIndex = Math.floor(i / 2);

      const leftId = leftIndex <= 31 ? `@${leftIndex}` : null;
      const rightId = rightIndex <= 31 ? `@${rightIndex}` : null;
      const parentId = parentIndex >= 1 ? `@${parentIndex}` : null;

      nodesRecord[id] = { id, leftId, rightId, parentId, val: { k: 'prim', t: 'int', v: i } };
      heapRecord[id] = {
        kind: 'object',
        type: 'TreeNode',
        fields: {
          val: { k: 'prim', t: 'int', v: i },
          left: leftId ? { k: 'ref', id: leftId } : { k: 'null' },
          right: rightId ? { k: 'ref', id: rightId } : { k: 'null' },
        },
      };
    }

    const tree31: BinaryTreeStructure = {
      kind: 'binaryTree',
      className: 'TreeNode',
      rootId: '@1',
      rootIds: ['@1'],
      allNodeIds,
      nodes: nodesRecord,
      brokenEdges: [],
      height: 5,
      nodeCount: 31,
      confidence: 'high',
      valueField: 'val',
      leftField: 'left',
      rightField: 'right',
      entryPoints: [{ label: 'root', target: '@1', source: 'local' }],
      hasCycle: false,
      hasSharedNode: false,
      isFragment: false,
    };

    const start = performance.now();
    const layout = computeTreeLayout(tree31, heapRecord);
    const durationMs = performance.now() - start;

    expect(layout.nodes.length).toBe(31);
    expect(layout.edges.length).toBe(30);
    console.log(`[31-Node Tree Performance] Layout calculated in ${durationMs.toFixed(3)}ms`);
    expect(durationMs).toBeLessThan(5);
  });
});
