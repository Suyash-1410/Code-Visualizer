import { describe, it, expect } from 'vitest';
import { EXAMPLES, findExampleById } from '../index';

describe('Phase 1 Examples Verification (PRD Section 13)', () => {
  it('contains exactly 9 Phase 1 examples with valid structure', () => {
    expect(EXAMPLES).toHaveLength(9);

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

    const notFound = findExampleById('non-existent');
    expect(notFound).toBeUndefined();
  });

  it('verifies all 9 examples through the real tracer API if server is running', async () => {
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
  }, 45000);
});
