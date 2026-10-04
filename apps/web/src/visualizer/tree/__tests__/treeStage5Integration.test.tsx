import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import { DiagramArea } from '../../DiagramArea';
import { computeTreeActiveNodes } from '../treeActiveNodes';
import { computeNodeProgressStates } from '../treeProgress';
import { TreeView } from '../TreeView';
import { recognize } from '../../../recognition';
import type { Trace, Step } from '../../../trace/types';
import type { BinaryTreeStructure } from '../../../recognition/types';

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

describe('Stage 5: Call Stack & Recursion Integration Suite', () => {
  describe('Edge Case 1: RecursiveDepthWithException', () => {
    it('preserves the active node and full recursion path up to the crash step', () => {
      const trace = loadFixture('RecursiveDepthWithException.json');
      expect(trace.status).toBe('ok'); // caught exception

      // Find the step where the exception was thrown
      const exceptionStep = trace.steps.find((s) => s.event === 'exception')!;
      expect(exceptionStep).toBeDefined();

      const rec = recognize(exceptionStep);
      expect(rec.trees).toBeDefined();
      expect(rec.trees!.length).toBeGreaterThan(0);
      const tree = rec.trees![0];

      // Compute active nodes at crash step
      const activeInfo = computeTreeActiveNodes(exceptionStep, tree);
      expect(activeInfo.activeNodeId).toBeDefined();
      expect(activeInfo.suspendedNodeIds.size).toBeGreaterThan(0);
      expect(activeInfo.pathEdgeIds.size).toBeGreaterThan(0);

      // Node progress states at exception step
      const progress = computeNodeProgressStates(trace, exceptionStep.i, tree, exceptionStep);
      expect(progress.counts.active).toBe(1);
      expect(progress.counts.in_progress).toBeGreaterThanOrEqual(1);

      // Render DiagramArea at exception step
      const { container } = render(
        <DiagramArea step={exceptionStep} />,
      );

      // Verify active node is highlighted and path edge is drawn
      const activeEl = container.querySelector('[data-progress="active"]');
      expect(activeEl).toBeInTheDocument();
    });
  });

  describe('Edge Case 2: InorderRecursive Progression & Output Linking', () => {
    it('transitions nodes from unvisited to active to in_progress to completed in traversal order', () => {
      const trace = loadFixture('InorderRecursive.json');
      expect(trace.status).toBe('ok');

      // Sample step 72: node 1 is completed, node 2 and 4 are in progress, node 3 is active
      const midStep = trace.steps[72];
      const rec = recognize(midStep);
      const tree = rec.trees![0];

      const progress = computeNodeProgressStates(trace, midStep.i, tree, midStep);
      expect(progress.counts.completed).toBe(1);
      expect(progress.counts.active).toBe(1);
      expect(progress.counts.in_progress).toBe(2);
      expect(progress.counts.unvisited).toBe(3);

      // At last executing step (main returning), root is active, remaining 6 nodes are completed
      const lastStep = trace.steps[trace.steps.length - 2];
      const finalProgress = computeNodeProgressStates(trace, lastStep.i, tree, lastStep);
      expect(finalProgress.counts.completed).toBe(6);
      expect(finalProgress.counts.active).toBe(1);
      expect(finalProgress.counts.unvisited).toBe(0);

      // At end step (program finished), all 7 nodes have completed
      const endStep = trace.steps[trace.steps.length - 1];
      const endProgress = computeNodeProgressStates(trace, endStep.i, tree, endStep);
      expect(endProgress.counts.completed).toBe(7);
      expect(endProgress.counts.unvisited).toBe(0);
    });
  });

  describe('Edge Case 3: Deep recursion / Skewed Tree (15+ nodes)', () => {
    it('keeps active node clear and tree readable with 15 nodes', () => {
      const trace = loadFixture('SkewedLeft.json');
      const lastStep = trace.steps[trace.steps.length - 2];
      const rec = recognize(lastStep);
      expect(rec.trees).toBeDefined();
      const tree = rec.trees![0];
      expect(tree.nodeCount).toBe(15);

      const activeInfo = computeTreeActiveNodes(lastStep, tree);
      expect(activeInfo).toBeDefined();

      const { container } = render(
        <DiagramArea step={lastStep} />,
      );

      expect(container.querySelector('[data-testid="tag-curr"]')).toBeInTheDocument();
      expect(container.querySelector('[data-testid="tag-root"]')).toBeInTheDocument();
    });
  });

  describe('Edge Case 4: Deletion of a node with an active tag', () => {
    it('handles tag on a deleted/ghost node without error', () => {
      const struct: BinaryTreeStructure = {
        kind: 'binaryTree',
        className: 'TreeNode',
        rootId: '@1',
        allNodeIds: ['@1'],
        nodes: {
          '@1': { id: '@1', val: { k: 'prim', v: 10 }, leftId: null, rightId: null, parentId: null },
        },
        brokenEdges: [],
        height: 1,
        nodeCount: 1,
        hasCycle: false,
        hasSharedNode: false,
        isFragment: false,
        confidence: 'high',
        valueField: 'val',
        leftField: 'left',
        rightField: 'right',
        rootIds: ['@1'],
        entryPoints: [{ label: 'curr', target: '@2', source: 'local' }],
      };

      const heap = {
        '@1': { kind: 'object' as const, type: 'TreeNode', fields: { val: { k: 'prim' as const, v: 10 } } },
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
            fields: { val: { k: 'prim' as const, v: 20 } },
            parentId: '@1',
            leftId: null,
            rightId: null,
            lastX: 100,
            lastY: 150,
          },
        ],
      };

      // Tag 'curr' points to deleted node @2
      render(
        <TreeView
          structure={struct}
          heap={heap}
          diffResult={diffResult}
          showGhosts={true}
        />,
      );

      expect(screen.getByTestId('ghost-badge-2')).toBeInTheDocument();
      expect(screen.getByTestId('tag-curr')).toBeInTheDocument();
    });
  });

  describe('Edge Case 5: Tag on orphaned node not in tree structure descriptor', () => {
    it('renders cleanly when tag points to an orphaned object', () => {
      const struct: BinaryTreeStructure = {
        kind: 'binaryTree',
        className: 'TreeNode',
        rootId: '@1',
        allNodeIds: ['@1'],
        nodes: {
          '@1': { id: '@1', val: { k: 'prim', v: 10 }, leftId: null, rightId: null, parentId: null },
        },
        brokenEdges: [],
        height: 1,
        nodeCount: 1,
        hasCycle: false,
        hasSharedNode: false,
        isFragment: false,
        confidence: 'high',
        valueField: 'val',
        leftField: 'left',
        rightField: 'right',
        rootIds: ['@1'],
        entryPoints: [
          { label: 'root', target: '@1', source: 'local' },
          { label: 'orphanVar', target: '@999', source: 'local' },
        ],
      };

      const heap = {
        '@1': { kind: 'object' as const, type: 'TreeNode', fields: { val: { k: 'prim' as const, v: 10 } } },
      };

      // TreeView should render @1 and ignore or isolate tag pointing to @999 without crashing
      render(<TreeView structure={struct} heap={heap} />);
      expect(screen.getByTestId('node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tag-root')).toBeInTheDocument();
    });
  });

  describe('Edge Case 6: Multiple frames referencing the same node during return', () => {
    it('correctly attributes active status to top frame and avoids duplicating suspended set', () => {
      const step: Step = {
        i: 20,
        event: 'return',
        line: 16,
        stack: [
          {
            frameId: 1,
            method: 'main',
            signature: '([Ljava/lang/String;)V',
            line: 10,
            locals: [{ name: 'root', type: 'TreeNode', value: { k: 'ref', id: '@10' } }],
          },
          {
            frameId: 2,
            method: 'inorder',
            signature: '(LTreeNode;)V',
            line: 15,
            locals: [{ name: 'node', type: 'TreeNode', value: { k: 'ref', id: '@10' } }],
          },
          {
            frameId: 3,
            method: 'inorder',
            signature: '(LTreeNode;)V',
            line: 15,
            locals: [{ name: 'node', type: 'TreeNode', value: { k: 'ref', id: '@10' } }],
          },
        ],
        heap: {},
        statics: [],
        returnValue: { k: 'void' },
        stdoutLen: 0,
        clipped: false,
      };

      const struct: BinaryTreeStructure = {
        kind: 'binaryTree',
        className: 'TreeNode',
        rootId: '@10',
        allNodeIds: ['@10'],
        nodes: {
          '@10': { id: '@10', val: { k: 'prim', v: 10 }, leftId: null, rightId: null, parentId: null },
        },
        brokenEdges: [],
        height: 1,
        nodeCount: 1,
        hasCycle: false,
        hasSharedNode: false,
        isFragment: false,
        confidence: 'high',
        valueField: 'val',
        leftField: 'left',
        rightField: 'right',
        rootIds: ['@10'],
        entryPoints: [],
      };

      const activeInfo = computeTreeActiveNodes(step, struct);
      // Top frame has @10, so activeNodeId is @10
      expect(activeInfo.activeNodeId).toBe('@10');
      // Suspended frames also have @10, but since it's already active, it shouldn't conflict
      expect(activeInfo.nodeToFrames.get('@10')?.length).toBe(3);
    });
  });
});
