/**
 * compile-error-markers.ts
 *
 * Converts JavaScope CompileError[] (from the trace schema) into Monaco
 * IMarkerData[] that can be placed as inline red squiggles.
 */

import type * as Monaco from 'monaco-editor';
import type { CompileError } from '../trace';

/**
 * Converts a list of CompileError objects (from the trace) to Monaco editor
 * marker data.  Columns from javac are 1-based; Monaco also uses 1-based, so
 * no adjustment is needed.  If `column` is 0 (unknown), we default to 1.
 */
export function compileErrorsToMarkers(
  errors: CompileError[],
): Monaco.editor.IMarkerData[] {
  return errors.map((err) => ({
    severity: 8 satisfies Monaco.MarkerSeverity, // MarkerSeverity.Error = 8
    startLineNumber: err.line,
    startColumn: err.column > 0 ? err.column : 1,
    endLineNumber: err.line,
    // Extend to the end of the line so the squiggle covers the whole line when
    // column is unknown, but keeps a minimum width of 1.
    endColumn: err.column > 0 ? err.column + 1 : Number.MAX_SAFE_INTEGER,
    message: err.message,
    source: 'javac',
  }));
}
