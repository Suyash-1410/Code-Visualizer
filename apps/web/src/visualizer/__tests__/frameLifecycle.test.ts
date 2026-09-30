import { describe, it, expect } from 'vitest';
import {
  deriveFrameLifecycle,
  formatMethodWithArgs,
  formatArgValue,
} from '../frameLifecycle';
import type { StackFrame } from '../../trace/types';

function makeFrame(
  frameId: number,
  method = 'fact',
  signature = 'int fact(int)',
  locals: { name: string; val: number | string }[] = [],
  line = 1,
): StackFrame {
  return {
    frameId,
    method,
    signature,
    line,
    locals: locals.map((l) => ({
      name: l.name,
      type: typeof l.val === 'number' ? 'int' : 'String',
      value:
        typeof l.val === 'number'
          ? { k: 'prim', t: 'int', v: l.val }
          : { k: 'str', v: l.val, full: true },
    })),
  };
}

describe('deriveFrameLifecycle — basic transitions', () => {
  it('detects a pushed frame on method call', () => {
    const f1 = makeFrame(1, 'main');
    const f2 = makeFrame(2, 'fib');

    const result = deriveFrameLifecycle([f1], [f1, f2]);
    expect(result.pushed).toEqual([f2]);
    expect(result.popped).toEqual([]);
    expect(result.persisted).toEqual([f1]);
  });

  it('detects a popped frame on method return', () => {
    const f1 = makeFrame(1, 'main');
    const f2 = makeFrame(2, 'fib');

    const result = deriveFrameLifecycle([f1, f2], [f1]);
    expect(result.pushed).toEqual([]);
    expect(result.popped).toEqual([f2]);
    expect(result.persisted).toEqual([f1]);
  });

  it('detects no change on normal line step within same frame', () => {
    const f1 = makeFrame(1, 'main', undefined, [], 2);
    const f2 = makeFrame(2, 'fib', undefined, [], 10);
    const f2Updated = makeFrame(2, 'fib', undefined, [], 11);

    const result = deriveFrameLifecycle([f1, f2], [f1, f2Updated]);
    expect(result.pushed).toEqual([]);
    expect(result.popped).toEqual([]);
    expect(result.persisted).toEqual([f1, f2Updated]);
  });

  it('reverses correctly when stepping backward (popped frame restored)', () => {
    const f1 = makeFrame(1, 'main');
    const f2 = makeFrame(2, 'fib');

    // Stepping forward popped f2: [f1, f2] -> [f1]
    // Stepping backward is: [f1] -> [f1, f2]
    const backwardResult = deriveFrameLifecycle([f1], [f1, f2]);
    expect(backwardResult.pushed).toEqual([f2]);
    expect(backwardResult.popped).toEqual([]);
  });

  it('reverses correctly when stepping backward into call (pushed frame removed)', () => {
    const f1 = makeFrame(1, 'main');
    const f2 = makeFrame(2, 'fib');

    // Stepping backward before call: [f1, f2] -> [f1]
    const backwardResult = deriveFrameLifecycle([f1, f2], [f1]);
    expect(backwardResult.popped).toEqual([f2]);
    expect(backwardResult.pushed).toEqual([]);
  });
});

describe('deriveFrameLifecycle — recursive fixtures', () => {
  it('factorial: growth and unwind lifecycle', () => {
    // Sequence of stack states in recursive factorial(3)
    const step0 = [makeFrame(1, 'Factorial.main', 'void main(String[])', [{ name: 'args', val: 'arr' }])];
    const step1 = [...step0, makeFrame(2, 'Factorial.fact', 'int fact(int)', [{ name: 'n', val: 3 }])];
    const step2 = [...step1, makeFrame(3, 'Factorial.fact', 'int fact(int)', [{ name: 'n', val: 2 }])];
    const step3 = [...step2, makeFrame(4, 'Factorial.fact', 'int fact(int)', [{ name: 'n', val: 1 }])];

    // Call phase: frames pushed one by one
    expect(deriveFrameLifecycle(step0, step1).pushed[0].frameId).toBe(2);
    expect(deriveFrameLifecycle(step1, step2).pushed[0].frameId).toBe(3);
    expect(deriveFrameLifecycle(step2, step3).pushed[0].frameId).toBe(4);

    // Return unwind: frame 4 returns to frame 3
    const unwind1 = deriveFrameLifecycle(step3, step2);
    expect(unwind1.popped[0].frameId).toBe(4);
    expect(unwind1.persisted.length).toBe(3);

    // Backward step during unwind restores frame 4
    const backUnwind = deriveFrameLifecycle(step2, step3);
    expect(backUnwind.pushed[0].frameId).toBe(4);
  });

  it('fibonacci: branching recursion push/pop', () => {
    const fMain = makeFrame(1, 'Fib.main');
    const fFib3 = makeFrame(2, 'Fib.fib', 'int fib(int)', [{ name: 'n', val: 3 }]);
    const fFib2 = makeFrame(3, 'Fib.fib', 'int fib(int)', [{ name: 'n', val: 2 }]);
    const fFib1 = makeFrame(4, 'Fib.fib', 'int fib(int)', [{ name: 'n', val: 1 }]);

    // fib(3) -> fib(2) -> fib(1)
    const s0 = [fMain, fFib3];
    const s1 = [fMain, fFib3, fFib2];
    const s2 = [fMain, fFib3, fFib2, fFib1];

    expect(deriveFrameLifecycle(s0, s1).pushed[0].frameId).toBe(3);
    expect(deriveFrameLifecycle(s1, s2).pushed[0].frameId).toBe(4);

    // fib(1) returns
    const s3 = [fMain, fFib3, fFib2];
    expect(deriveFrameLifecycle(s2, s3).popped[0].frameId).toBe(4);

    // fib(0) called from fib(2)
    const fFib0 = makeFrame(5, 'Fib.fib', 'int fib(int)', [{ name: 'n', val: 0 }]);
    const s4 = [fMain, fFib3, fFib2, fFib0];
    const forkCall = deriveFrameLifecycle(s3, s4);
    expect(forkCall.pushed[0].frameId).toBe(5);
  });

  it('mutual recursion: alternating method names', () => {
    const fMain = makeFrame(1, 'Mutual.main');
    const fEven = makeFrame(2, 'Mutual.isEven', 'boolean isEven(int)', [{ name: 'n', val: 2 }]);
    const fOdd = makeFrame(3, 'Mutual.isOdd', 'boolean isOdd(int)', [{ name: 'n', val: 1 }]);
    const fEven0 = makeFrame(4, 'Mutual.isEven', 'boolean isEven(int)', [{ name: 'n', val: 0 }]);

    const s1 = [fMain, fEven];
    const s2 = [fMain, fEven, fOdd];
    const s3 = [fMain, fEven, fOdd, fEven0];

    const t1 = deriveFrameLifecycle(s1, s2);
    expect(t1.pushed[0].method).toBe('Mutual.isOdd');

    const t2 = deriveFrameLifecycle(s2, s3);
    expect(t2.pushed[0].method).toBe('Mutual.isEven');

    // Return unwind
    const t3 = deriveFrameLifecycle(s3, s2);
    expect(t3.popped[0].method).toBe('Mutual.isEven');
  });
});

describe('formatMethodWithArgs', () => {
  it('formats single parameter method: fib(n = 3)', () => {
    const frame = makeFrame(2, 'fib', 'int fib(int)', [{ name: 'n', val: 3 }]);
    expect(formatMethodWithArgs(frame)).toBe('fib(n = 3)');
  });

  it('strips class prefix: Factorial.fact -> fact(n = 5)', () => {
    const frame = makeFrame(2, 'Factorial.fact', 'int fact(int)', [{ name: 'n', val: 5 }]);
    expect(formatMethodWithArgs(frame)).toBe('fact(n = 5)');
  });

  it('formats main with args', () => {
    const frame = makeFrame(1, 'Main.main', 'void main(String[])', [{ name: 'args', val: 'args' }]);
    expect(formatMethodWithArgs(frame)).toBe('main(args = "args")');
  });

  it('formats method with no args', () => {
    const frame = makeFrame(1, 'run', 'void run()', []);
    expect(formatMethodWithArgs(frame)).toBe('run()');
  });

  it('formats multiple parameter method: gcd(a = 12, b = 8)', () => {
    const frame: StackFrame = {
      frameId: 2,
      method: 'MathUtil.gcd',
      signature: 'int gcd(int, int)',
      line: 5,
      locals: [
        { name: 'a', type: 'int', value: { k: 'prim', t: 'int', v: 12 } },
        { name: 'b', type: 'int', value: { k: 'prim', t: 'int', v: 8 } },
        { name: 'temp', type: 'int', value: { k: 'prim', t: 'int', v: 0 } }, // non-param local ignored
      ],
    };
    expect(formatMethodWithArgs(frame)).toBe('gcd(a = 12, b = 8)');
  });
});

describe('formatArgValue', () => {
  it('formats primitive numbers and booleans', () => {
    expect(formatArgValue({ k: 'prim', t: 'int', v: 42 })).toBe('42');
    expect(formatArgValue({ k: 'prim', t: 'boolean', v: true })).toBe('true');
  });

  it('formats null and void', () => {
    expect(formatArgValue({ k: 'null' })).toBe('null');
    expect(formatArgValue({ k: 'void' })).toBe('void');
  });

  it('formats ref with id', () => {
    expect(formatArgValue({ k: 'ref', id: '@12' })).toBe('@12');
  });
});
