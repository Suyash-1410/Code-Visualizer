/**
 * useEditorSync — drives Monaco decorations and scroll from currentStepIndex.
 *
 * - Adds a blue highlight decoration on the current step's line.
 * - Uses a red highlight for `exception` steps.
 * - Auto-scrolls the current line into view (respects prefers-reduced-motion).
 * - Clears all decorations when the trace is cleared.
 * - The actual CSS classes are defined in index.css.
 */

import { useEffect, useRef } from 'react';
import type * as Monaco from 'monaco-editor';
import { useAppStore } from '../store';
import { useCurrentStep } from '../store';
import { useMediaQuery } from './useMediaQuery';

export function useEditorSync(
  editorRef: React.RefObject<Monaco.editor.IStandaloneCodeEditor | null>,
  monacoRef: React.RefObject<typeof Monaco | null>,
) {
  const trace = useAppStore((s) => s.trace);
  const step = useCurrentStep();
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

  // Monaco deltaDecorations returns an array of decoration IDs that must be
  // passed back to clear/replace them.
  const decorationIdsRef = useRef<string[]>([]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    // Clear decorations when no trace or no meaningful step
    if (!trace || !step || step.stack.length === 0) {
      decorationIdsRef.current = editor.deltaDecorations(
        decorationIdsRef.current,
        [],
      );
      return;
    }

    const line = step.line;
    const isException = step.event === 'exception';

    decorationIdsRef.current = editor.deltaDecorations(
      decorationIdsRef.current,
      [
        {
          range: new monaco.Range(line, 1, line, Number.MAX_SAFE_INTEGER),
          options: {
            isWholeLine: true,
            className: isException
              ? 'javascope-exception-line'
              : 'javascope-current-line',
            glyphMarginClassName: isException
              ? 'javascope-exception-glyph'
              : 'javascope-step-glyph',
            // Tooltip on the glyph
            glyphMarginHoverMessage: {
              value: isException
                ? `⚠ Exception at line ${String(line)}`
                : `→ Step at line ${String(line)}`,
            },
          },
        },
      ],
    );

    // Scroll into view — use revealLine (no animation) when reduced motion
    if (prefersReducedMotion) {
      editor.revealLine(line);
    } else {
      editor.revealLineInCenterIfOutsideViewport(line);
    }
  }, [trace, step, editorRef, monacoRef, prefersReducedMotion]);

  // Clear decorations on unmount
  useEffect(() => {
    // Capture current value in local var — the ref may change by cleanup time
    const editor = editorRef.current;
    const ids = decorationIdsRef.current;
    return () => {
      if (editor && ids.length > 0) {
        editor.deltaDecorations(ids, []);
      }
    };
  }, [editorRef]);

}
