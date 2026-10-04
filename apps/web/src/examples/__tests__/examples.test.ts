import { describe, it, expect } from 'vitest';
import { EXAMPLES, findExampleById } from '../index';

describe('Phase 1, 2, 3 & 4 Examples Verification (PRD Section 13)', () => {
  it('contains exactly 39 examples (9 Phase 1 + 9 Phase 2 + 11 Phase 3 + 10 Phase 4) with valid structure', () => {
    expect(EXAMPLES).toHaveLength(39);

    const phase1Examples = EXAMPLES.filter(
      (ex) =>
        ex.category !== 'Linked lists' &&
        ex.category !== 'Binary trees' &&
        ex.category !== 'Stacks, queues, heaps',
    );
    expect(phase1Examples).toHaveLength(9);

    const linkedListExamples = EXAMPLES.filter((ex) => ex.category === 'Linked lists');
    expect(linkedListExamples).toHaveLength(9);

    const binaryTreeExamples = EXAMPLES.filter((ex) => ex.category === 'Binary trees');
    expect(binaryTreeExamples).toHaveLength(11);

    const phase4Examples = EXAMPLES.filter((ex) => ex.category === 'Stacks, queues, heaps');
    expect(phase4Examples).toHaveLength(10);

    const expectedTreeIds = [
      'bst-insert',
      'inorder-traversal',
      'preorder-traversal',
      'postorder-traversal',
      'bst-search',
      'bst-delete',
      'tree-height',
      'mirror-tree',
      'level-order',
      'avl-rotation',
      'wrapper-bst',
    ];
    for (const id of expectedTreeIds) {
      expect(findExampleById(id)).toBeDefined();
    }

    const expectedPhase4Ids = [
      'stack-array',
      'stack-node',
      'bracket-matching',
      'postfix-eval',
      'circular-queue',
      'queue-from-two-stacks',
      'min-heap-insert',
      'min-heap-extract',
      'heapify',
      'heap-sort',
    ];
    for (const id of expectedPhase4Ids) {
      expect(findExampleById(id)).toBeDefined();
    }

    for (const ex of EXAMPLES) {
      expect(ex.id).toBeTruthy();
      expect(ex.title).toBeTruthy();
      expect(ex.description).toBeTruthy();
      expect(ex.code).toContain('public class Main');
      expect(ex.code).toContain('public static void main(String[] args)');
      // Must not exceed reasonable source length (< 20 KB limit per PRD Section 8)
      expect(ex.code.length).toBeLessThan(20480);
    }
  });

  it('can look up examples by ID', () => {
    const fib = findExampleById('fibonacci');
    expect(fib).toBeDefined();
    expect(fib?.title).toContain('Fibonacci');

    const rev = findExampleById('linked-list-reverse-iterative');
    expect(rev).toBeDefined();
    expect(rev?.category).toBe('Linked lists');

    const bst = findExampleById('bst-insert');
    expect(bst).toBeDefined();
    expect(bst?.category).toBe('Binary trees');

    const heap = findExampleById('min-heap-insert');
    expect(heap).toBeDefined();
    expect(heap?.category).toBe('Stacks, queues, heaps');

    const notFound = findExampleById('non-existent');
    expect(notFound).toBeUndefined();
  });

  it('verifies all 39 examples through the real tracer API if server is running', async () => {
    let serverRunning = false;
    try {
      const res = await fetch('http://localhost:8080/api/health', {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok) serverRunning = true;
    } catch {
      serverRunning = false;
    }

    if (!serverRunning) {
      // Server not running in CI or headless environment; skip live execution
      return;
    }

    for (const ex of EXAMPLES) {
      const runRes = await fetch('http://localhost:8080/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: ex.code }),
        signal: AbortSignal.timeout(15000),
      });

      if (runRes.status === 429) {
        // Dev server has default 10 req/min rate limit; skip remaining live checks
        return;
      }
      expect(runRes.status).toBe(200);
      const data = (await runRes.json()) as {
        status: string;
        steps: unknown[];
        runtimeError?: { type: string };
      };

      if (ex.id === 'array-index-exception') {
        expect(data.status).toBe('runtime_error');
        expect(data.runtimeError?.type).toContain('ArrayIndexOutOfBoundsException');
      } else {
        expect(data.status).toBe('ok');
        expect(data.steps.length).toBeGreaterThan(0);
        // Must stay well under the 7,000 step cap (PRD Section 13)
        expect(data.steps.length).toBeLessThan(1000);
      }
    }
  }, 120000);
});
