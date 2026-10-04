import { describe, it, expect } from 'vitest';
import { computeNodeProgressStates } from '../treeProgress';
import type { Trace, Step } from '../../../trace/types';
import type { BinaryTreeStructure } from '../../../recognition/types';

describe('treeProgress (Phase 3 Stage 5)', () => {
  const dummyTree: BinaryTreeStructure = {
    kind: 'binaryTree',
    className: 'TreeNode',
    rootId: '@4',
    rootIds: ['@4'],
    allNodeIds: ['@4', '@2', '@6', '@1', '@3'],
    nodes: {
      '@4': { id: '@4', val: null, leftId: '@2', rightId: '@6', parentId: null },
      '@2': { id: '@2', val: null, leftId: '@1', rightId: '@3', parentId: '@4' },
      '@6': { id: '@6', val: null, leftId: null, rightId: null, parentId: '@4' },
      '@1': { id: '@1', val: null, leftId: null, rightId: null, parentId: '@2' },
      '@3': { id: '@3', val: null, leftId: null, rightId: null, parentId: '@2' },
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
    entryPoints: [{ label: 'root', target: '@4', source: 'local' }],
  };

  it('marks all nodes as unvisited before traversal starts', () => {
    const step0: Step = {
      i: 0,
      event: 'line',
      line: 10,
      stack: [
        {
          frameId: 1,
          method: 'main',
          signature: '([Ljava/lang/String;)V',
          line: 10,
          locals: [{ name: 'root', type: 'TreeNode', value: { k: 'ref', id: '@4' } }],
        },
      ],
      heap: {},
      statics: [],
      returnValue: null,
      stdoutLen: 0,
      clipped: false,
    };

    const trace: Trace = {
      status: 'ok',
      steps: [step0],
      source: '',
      stdout: '',
      schemaVersion: 1,
      truncation: null,
      compileErrors: [],
      runtimeError: null,
      stats: { stepCount: 1, maxDepth: 1, durationMs: 0 },
    };

    const res = computeNodeProgressStates(trace, 0, dummyTree);
    expect(res.states.get('@4')).toBe('active');
    expect(res.states.get('@2')).toBe('unvisited');
    expect(res.states.get('@6')).toBe('unvisited');
    expect(res.states.get('@1')).toBe('unvisited');
    expect(res.states.get('@3')).toBe('unvisited');
    expect(res.counts.unvisited).toBe(4);
  });

  it('marks active, in_progress, and completed nodes during recursion return', () => {
    // Simulate:
    // Step 0: main calls inorder(@4) -> frame 2
    // Step 1: inorder(@4) calls inorder(@2) -> frame 3
    // Step 2: inorder(@2) calls inorder(@1) -> frame 4
    // Step 3: inorder(@1) returns back to frame 3
    const step0: Step = {
      i: 0,
      event: 'call',
      line: 15,
      stack: [
        {
          frameId: 1,
          method: 'main',
          signature: '([Ljava/lang/String;)V',
          line: 11,
          locals: [{ name: 'root', type: 'TreeNode', value: { k: 'ref', id: '@4' } }],
        },
        {
          frameId: 2,
          method: 'inorder',
          signature: '(LTreeNode;)V',
          line: 15,
          locals: [{ name: 'node', type: 'TreeNode', value: { k: 'ref', id: '@4' } }],
        },
      ],
      heap: {},
      statics: [],
      returnValue: null,
      stdoutLen: 0,
      clipped: false,
    };

    const step1: Step = {
      i: 1,
      event: 'call',
      line: 15,
      stack: [
        ...step0.stack,
        {
          frameId: 3,
          method: 'inorder',
          signature: '(LTreeNode;)V',
          line: 15,
          locals: [{ name: 'node', type: 'TreeNode', value: { k: 'ref', id: '@2' } }],
        },
      ],
      heap: {},
      statics: [],
      returnValue: null,
      stdoutLen: 0,
      clipped: false,
    };

    const step2: Step = {
      i: 2,
      event: 'call',
      line: 15,
      stack: [
        ...step1.stack,
        {
          frameId: 4,
          method: 'inorder',
          signature: '(LTreeNode;)V',
          line: 15,
          locals: [{ name: 'node', type: 'TreeNode', value: { k: 'ref', id: '@1' } }],
        },
      ],
      heap: {},
      statics: [],
      returnValue: null,
      stdoutLen: 0,
      clipped: false,
    };

    // Frame 4 returns: stack has frame 1, 2, 3
    const step3: Step = {
      i: 3,
      event: 'line',
      line: 18,
      stack: [
        step0.stack[0],
        step0.stack[1],
        step1.stack[2], // frame 3 (@2) is on top again
      ],
      heap: {},
      statics: [],
      returnValue: null,
      stdoutLen: 2,
      clipped: false,
    };

    const trace: Trace = {
      status: 'ok',
      steps: [step0, step1, step2, step3],
      source: '',
      stdout: '1 ',
      schemaVersion: 1,
      truncation: null,
      compileErrors: [],
      runtimeError: null,
      stats: { stepCount: 4, maxDepth: 4, durationMs: 0 },
    };

    const res = computeNodeProgressStates(trace, 3, dummyTree);

    // At step 3:
    // Frame 3 has active node @2 -> 'active'
    // Frame 2 has node @4 -> 'in_progress'
    // Frame 4 visited @1 and has returned -> 'completed'!
    // Nodes @6 and @3 have not yet been visited -> 'unvisited'
    expect(res.states.get('@2')).toBe('active');
    expect(res.states.get('@4')).toBe('in_progress');
    expect(res.states.get('@1')).toBe('completed');
    expect(res.states.get('@3')).toBe('unvisited');
    expect(res.states.get('@6')).toBe('unvisited');

    expect(res.counts).toEqual({
      active: 1,
      in_progress: 1,
      completed: 1,
      unvisited: 2,
    });
  });
});
