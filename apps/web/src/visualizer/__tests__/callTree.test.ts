import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildCallTree,
  findNodesByMethod,
  formatCallTreeReturn,
} from '../callTree';
import type { Trace } from '../../trace/types';

function loadFixture(filename: string): Trace {
  // Resolve path from repo root
  const fixturePath = path.resolve(
    process.cwd(),
    '../../tests/fixtures/traces',
    filename,
  );
  const raw = fs.readFileSync(fixturePath, 'utf8');
  return JSON.parse(raw) as Trace;
}

describe('buildCallTree — Factorial', () => {
  it('derives linear recursive tree with correct return values', () => {
    const trace = loadFixture('factorial-5-trace.json');
    const roots = buildCallTree(trace);

    expect(roots).toHaveLength(1);
    const mainNode = roots[0];
    expect(mainNode.method).toBe('main');

    const factNodes = findNodesByMethod(roots, 'fact');
    expect(factNodes).toHaveLength(5);

    // Verify parent-child chain: fact(5) -> fact(4) -> fact(3) -> fact(2) -> fact(1)
    const fact5 = factNodes[0];
    expect(fact5.args).toContain('n = 5');
    expect(fact5.children).toHaveLength(1);

    const fact4 = fact5.children[0];
    expect(fact4.args).toContain('n = 4');
    expect(fact4.children).toHaveLength(1);

    const fact3 = fact4.children[0];
    expect(fact3.args).toContain('n = 3');

    const fact2 = fact3.children[0];
    expect(fact2.args).toContain('n = 2');

    const fact1 = fact2.children[0];
    expect(fact1.args).toContain('n = 1');
    expect(fact1.children).toHaveLength(0);

    // Verify return values: 1, 2, 6, 24, 120
    expect(formatCallTreeReturn(fact1.returnValue)).toBe('1');
    expect(formatCallTreeReturn(fact2.returnValue)).toBe('2');
    expect(formatCallTreeReturn(fact3.returnValue)).toBe('6');
    expect(formatCallTreeReturn(fact4.returnValue)).toBe('24');
    expect(formatCallTreeReturn(fact5.returnValue)).toBe('120');

    // Steps order
    for (const node of factNodes) {
      expect(node.callStep).toBeLessThan(node.returnStep!);
    }
  });
});

describe('buildCallTree — Fibonacci(5)', () => {
  it('derives exactly 15 fib nodes with correct return values', () => {
    const trace = loadFixture('fibonacci-trace.json');
    const roots = buildCallTree(trace);

    const fibNodes = findNodesByMethod(roots, 'fib');
    // Prompt requirement: "fib(5) (15 nodes with correct return values)"
    expect(fibNodes).toHaveLength(15);

    // Root fib call is fib(5)
    const rootFib = fibNodes[0];
    expect(rootFib.args).toContain('n = 5');
    expect(formatCallTreeReturn(rootFib.returnValue)).toBe('5');

    // fib(5) has two children in call order: fib(4) then fib(3)
    expect(rootFib.children).toHaveLength(2);
    expect(rootFib.children[0].args).toContain('n = 4');
    expect(rootFib.children[1].args).toContain('n = 3');

    // Verify return values on all 15 nodes
    for (const node of fibNodes) {
      expect(node.returnStep).not.toBeNull();
      const val = formatCallTreeReturn(node.returnValue);
      expect(['0', '1', '2', '3', '5']).toContain(val);
    }
  });
});

describe('buildCallTree — MutualRecursion', () => {
  it('derives alternating isEven and isOdd call tree', () => {
    const trace = loadFixture('mutual-recursion-trace.json');
    const roots = buildCallTree(trace);

    const isEvenNodes = findNodesByMethod(roots, 'isEven');
    const isOddNodes = findNodesByMethod(roots, 'isOdd');

    expect(isEvenNodes).toHaveLength(3); // n=4, n=2, n=0
    expect(isOddNodes).toHaveLength(2);  // n=3, n=1

    // Root isEven(4) -> child isOdd(3) -> child isEven(2) -> child isOdd(1) -> child isEven(0)
    const rootEven = isEvenNodes[0];
    expect(rootEven.args).toContain('n = 4');
    expect(rootEven.children[0].method).toBe('isOdd');
    expect(rootEven.children[0].args).toContain('n = 3');
    expect(rootEven.children[0].children[0].method).toBe('isEven');
  });
});

describe('buildCallTree — Tower of Hanoi', () => {
  it('derives 7 recursive solve calls in binary tree structure', () => {
    const trace = loadFixture('tower-of-hanoi-trace.json');
    const roots = buildCallTree(trace);

    const solveNodes = findNodesByMethod(roots, 'solve');
    // 2^3 - 1 = 7 calls
    expect(solveNodes).toHaveLength(7);

    const rootSolve = solveNodes[0];
    expect(rootSolve.args).toContain('n = 3');
    expect(rootSolve.children).toHaveLength(2);

    // Left and right subtrees
    const leftSolve = rootSolve.children[0];
    const rightSolve = rootSolve.children[1];
    expect(leftSolve.args).toContain('n = 2');
    expect(rightSolve.args).toContain('n = 2');

    expect(leftSolve.children).toHaveLength(2);
    expect(rightSolve.children).toHaveLength(2);

    expect(leftSolve.children[0].args).toContain('n = 1');
    expect(leftSolve.children[1].args).toContain('n = 1');
  });
});

describe('buildCallTree — Exception in Recursion', () => {
  it('tracks frames that never returned normally due to thrown exception', () => {
    const trace = loadFixture('recursion-exception-trace.json');
    const roots = buildCallTree(trace);

    const recurseNodes = findNodesByMethod(roots, 'recurse');
    expect(recurseNodes.length).toBeGreaterThan(0);

    // Nodes that unwound due to exception should not have returnStep
    const exceptionThrower = recurseNodes[recurseNodes.length - 1];
    expect(exceptionThrower.returnStep).toBeNull();
    expect(exceptionThrower.hasException).toBe(true);
  });
});
