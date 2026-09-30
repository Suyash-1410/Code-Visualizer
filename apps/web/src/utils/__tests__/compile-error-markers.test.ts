/**
 * Tests for compile-error → Monaco marker conversion.
 */

import { describe, it, expect } from 'vitest';
import { compileErrorsToMarkers } from '../../utils/compile-error-markers';
import type { CompileError } from '../../trace';

describe('compileErrorsToMarkers', () => {
  it('converts a single error correctly', () => {
    const errors: CompileError[] = [
      { line: 5, column: 12, message: "; expected" },
    ];
    const markers = compileErrorsToMarkers(errors);
    expect(markers).toHaveLength(1);
    expect(markers[0].startLineNumber).toBe(5);
    expect(markers[0].startColumn).toBe(12);
    expect(markers[0].endLineNumber).toBe(5);
    expect(markers[0].endColumn).toBe(13); // column + 1
    expect(markers[0].message).toBe('; expected');
    expect(markers[0].source).toBe('javac');
    expect(markers[0].severity).toBe(8); // MarkerSeverity.Error
  });

  it('converts multiple errors', () => {
    const errors: CompileError[] = [
      { line: 1, column: 1, message: 'error one' },
      { line: 10, column: 5, message: 'error two' },
    ];
    const markers = compileErrorsToMarkers(errors);
    expect(markers).toHaveLength(2);
    expect(markers[1].startLineNumber).toBe(10);
    expect(markers[1].message).toBe('error two');
  });

  it('defaults column 0 to column 1', () => {
    const errors: CompileError[] = [
      { line: 3, column: 0, message: 'unknown column' },
    ];
    const markers = compileErrorsToMarkers(errors);
    expect(markers[0].startColumn).toBe(1);
    expect(markers[0].endColumn).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('returns empty array for no errors', () => {
    expect(compileErrorsToMarkers([])).toEqual([]);
  });
});
