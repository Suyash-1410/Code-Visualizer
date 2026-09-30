import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  validateTrace,
  getStep,
  getVisibleStdout,
  buildFrameIndex,
  type Trace,
} from '../index';

describe('Trace Schema & Validation (Vitest)', () => {
  const fixturesDir = path.resolve(__dirname, '../../../../../tests/fixtures/traces');

  function loadFixture(filename: string): unknown {
    const filePath = path.join(fixturesDir, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  }

  it('validates simple-variables.json fixture', () => {
    const raw = loadFixture('simple-variables.json');
    const result = validateTrace(raw);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const trace = result.data;
    expect(trace.schemaVersion).toBe(1);
    expect(trace.status).toBe('ok');
    expect(trace.steps).toHaveLength(7);
    expect(trace.stdout).toBe('sum=30\n');

    // Round-trip check
    const serialized = JSON.stringify(trace);
    const roundTrippedResult = validateTrace(JSON.parse(serialized));
    expect(roundTrippedResult.success).toBe(true);
  });

  it('validates recursive-factorial.json fixture', () => {
    const raw = loadFixture('recursive-factorial.json');
    const result = validateTrace(raw);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const trace = result.data;
    expect(trace.schemaVersion).toBe(1);
    expect(trace.status).toBe('ok');
    expect(trace.steps).toHaveLength(19);
    expect(trace.stats.maxDepth).toBe(4);

    // Verify step 8 has depth 4
    const step8 = getStep(trace, 8);
    expect(step8?.stack).toHaveLength(4);

    // Verify step 11 returns 1
    const step11 = getStep(trace, 11);
    expect(step11?.returnValue).toEqual({ k: 'prim', t: 'int', v: 1 });

    // Round-trip check
    const serialized = JSON.stringify(trace);
    const roundTrippedResult = validateTrace(JSON.parse(serialized));
    expect(roundTrippedResult.success).toBe(true);
  });

  it('validates linked-list-and-array.json fixture', () => {
    const raw = loadFixture('linked-list-and-array.json');
    const result = validateTrace(raw);

    expect(result.success).toBe(true);
    if (!result.success) return;

    const trace = result.data;
    expect(trace.schemaVersion).toBe(1);
    expect(trace.status).toBe('ok');
    expect(trace.steps).toHaveLength(7);

    // Check step 4 heap
    const step4 = getStep(trace, 4);
    expect(step4).toBeDefined();
    expect(step4?.heap['@10']).toEqual({
      kind: 'array',
      elemType: 'int',
      length: 3,
      items: [
        { k: 'prim', t: 'int', v: 10 },
        { k: 'prim', t: 'int', v: 20 },
        { k: 'prim', t: 'int', v: 30 },
      ],
      clipped: false,
    });

    const node20 = step4?.heap['@20'];
    expect(node20?.kind).toBe('object');
    if (node20?.kind === 'object') {
      expect(node20.fields.next).toEqual({ k: 'ref', id: '@21' });
    }

    // Round-trip check
    const serialized = JSON.stringify(trace);
    const roundTrippedResult = validateTrace(JSON.parse(serialized));
    expect(roundTrippedResult.success).toBe(true);
  });

  it('fails validation on invalid schemaVersion or corrupted data', () => {
    const raw = loadFixture('simple-variables.json') as Record<string, unknown>;
    const invalid = { ...raw, schemaVersion: 2 };
    const result = validateTrace(invalid);
    expect(result.success).toBe(false);
  });
});

describe('Trace Helpers', () => {
  const fixturesDir = path.resolve(__dirname, '../../../../../tests/fixtures/traces');

  function loadTrace(filename: string): Trace {
    const filePath = path.join(fixturesDir, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    const result = validateTrace(parsed);
    if (!result.success) {
      throw new Error(`Failed to load fixture ${filename}: ${result.error}`);
    }
    return result.data;
  }

  describe('getStep', () => {
    it('returns the step at index within bounds', () => {
      const trace = loadTrace('simple-variables.json');
      const step0 = getStep(trace, 0);
      expect(step0).toBeDefined();
      expect(step0?.i).toBe(0);
      expect(step0?.event).toBe('call');

      const step6 = getStep(trace, 6);
      expect(step6).toBeDefined();
      expect(step6?.i).toBe(6);
      expect(step6?.event).toBe('end');
    });

    it('returns undefined for negative or out-of-bounds index', () => {
      const trace = loadTrace('simple-variables.json');
      expect(getStep(trace, -1)).toBeUndefined();
      expect(getStep(trace, 999)).toBeUndefined();
    });
  });

  describe('getVisibleStdout', () => {
    it('returns correct substring based on stdoutLen', () => {
      const trace = loadTrace('simple-variables.json');
      expect(getVisibleStdout(trace, 0)).toBe('');
      expect(getVisibleStdout(trace, 4)).toBe('');
      expect(getVisibleStdout(trace, 5)).toBe('sum=30\n');
      expect(getVisibleStdout(trace, 6)).toBe('sum=30\n');
    });

    it('returns empty string for invalid indices', () => {
      const trace = loadTrace('simple-variables.json');
      expect(getVisibleStdout(trace, -1)).toBe('');
      expect(getVisibleStdout(trace, 100)).toBe('');
    });
  });

  describe('buildFrameIndex', () => {
    it('computes accurate frame spans for recursive-factorial.json', () => {
      const trace = loadTrace('recursive-factorial.json');
      const frameIndex = buildFrameIndex(trace);

      // Frame 1 is main: active from step 0 to step 17
      expect(frameIndex.get(1)).toEqual({
        frameId: 1,
        startStep: 0,
        endStep: 17,
      });

      // Frame 2 is fact(3): active from step 2 to step 15
      expect(frameIndex.get(2)).toEqual({
        frameId: 2,
        startStep: 2,
        endStep: 15,
      });

      // Frame 3 is fact(2): active from step 5 to step 13
      expect(frameIndex.get(3)).toEqual({
        frameId: 3,
        startStep: 5,
        endStep: 13,
      });

      // Frame 4 is fact(1): active from step 8 to step 11
      expect(frameIndex.get(4)).toEqual({
        frameId: 4,
        startStep: 8,
        endStep: 11,
      });
    });
  });
});
