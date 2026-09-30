/**
 * JavaEditor — Monaco editor wrapper.
 *
 * Stage 8 additions:
 *  - useEditorSync drives line decorations and auto-scroll from currentStepIndex.
 *  - Gutter click jumps to the first step that executes the clicked line.
 *  - useKeyboardShortcuts registered at this level (effect only, no render).
 */

import React, { useRef, useCallback } from 'react';
import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useAppStore } from '../store';
import { compileErrorsToMarkers } from '../utils/compile-error-markers';
import { runSource } from '../api';
import { validateTrace } from '../trace';
import { useEditorSync } from '../hooks/useEditorSync';
import { usePlayback } from '../hooks/usePlayback';

export const JavaEditor: React.FC = () => {
  const monacoRef = useRef<typeof Monaco | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const source = useAppStore((s) => s.source);
  const trace = useAppStore((s) => s.trace);
  const runState = useAppStore((s) => s.runState);
  const setSource = useAppStore((s) => s.setSource);
  const startRun = useAppStore((s) => s.startRun);
  const setTrace = useAppStore((s) => s.setTrace);
  const setError = useAppStore((s) => s.setError);
  const clearTrace = useAppStore((s) => s.clearTrace);

  // Gutter-click integration
  const { jumpToLine } = usePlayback();

  const isReadOnly = trace !== null;
  const isRunning = runState === 'running';

  // ── Editor sync: decorations + scroll ────────────────────────────────────
  useEditorSync(editorRef, monacoRef);

  // ── Compile-error markers ─────────────────────────────────────────────────
  const syncMarkers = useCallback(
    (monaco: typeof Monaco, model: Monaco.editor.ITextModel) => {
      if (!trace || trace.status !== 'compile_error') {
        monaco.editor.setModelMarkers(model, 'javascope', []);
        return;
      }
      const markers = compileErrorsToMarkers(trace.compileErrors);
      monaco.editor.setModelMarkers(model, 'javascope', markers);
    },
    [trace],
  );

  // ── Run action ────────────────────────────────────────────────────────────
  const run = useCallback(async () => {
    if (isRunning) return;
    const currentSource = editorRef.current?.getValue() ?? source;
    startRun();
    const result = await runSource(currentSource);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const validated = validateTrace(result.body);
    if (!validated.success) {
      setError(
        `Internal error: server returned an unrecognised trace format. ${validated.error}`,
      );
      return;
    }
    setTrace(validated.data);
    // Auto-start playback so traversal and step execution are animated immediately
    if (validated.data.steps.length > 1) {
      useAppStore.getState().setPlaying(true);
    }
    // Sync markers after trace loads
    if (monacoRef.current && editorRef.current) {
      const model = editorRef.current.getModel();
      if (model) syncMarkers(monacoRef.current, model);
    }
  }, [isRunning, source, startRun, setError, setTrace, syncMarkers]);

  // ── Monaco mount ──────────────────────────────────────────────────────────
  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Ctrl/Cmd+Enter → Run
    editor.addAction({
      id: 'javascope-run',
      label: 'Run program',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => void run(),
    });

    // Custom dark theme
    monaco.editor.defineTheme('javascope-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#0d1117',
        'editor.lineHighlightBackground': '#161b22',
        'editorLineNumber.foreground': '#3d444d',
        'editorLineNumber.activeForeground': '#7d8590',
        'editor.selectionBackground': '#264f78',
        'editorGutter.background': '#0d1117',
      },
    });
    monaco.editor.setTheme('javascope-dark');

    // Gutter (line-number) click → jump to first step at that line
    editor.onMouseDown((e) => {
      if (
        e.target.type ===
        monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS
      ) {
        const line = e.target.position?.lineNumber;
        if (line !== undefined) jumpToLine(line);
      }
    });
  };

  // Sync markers whenever trace changes
  React.useEffect(() => {
    if (!monacoRef.current || !editorRef.current) return;
    const model = editorRef.current.getModel();
    if (!model) return;
    syncMarkers(monacoRef.current, model);
  }, [syncMarkers]);

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/8 bg-canvas-subtle px-3">
        <span className="text-xs font-medium text-gray-400">Main.java</span>
        <div className="flex items-center gap-2">
          {isReadOnly && (
            <button
              onClick={clearTrace}
              className="rounded px-2 py-1 text-xs font-medium text-gray-300 hover:bg-white/8 hover:text-white"
              title="Clear trace and return to editing"
            >
              ✎ Edit
            </button>
          )}
          <button
            onClick={() => void run()}
            disabled={isRunning || isReadOnly}
            className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            title="Run (Ctrl+Enter)"
          >
            {isRunning ? (
              <>
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Running…
              </>
            ) : (
              <>▶ Run</>
            )}
          </button>
        </div>
      </div>

      {/* Monaco */}
      <div className="min-h-0 flex-1">
        <MonacoEditor
          language="java"
          value={source}
          options={{
            readOnly: isReadOnly,
            fontSize: 13,
            fontFamily:
              "'JetBrains Mono', 'Cascadia Code', 'Fira Code', Consolas, monospace",
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            glyphMargin: true,
            folding: true,
            wordWrap: 'off',
            tabSize: 4,
            renderLineHighlight: 'none', // we control highlights ourselves
            automaticLayout: true,
            overviewRulerLanes: 0,
            smoothScrolling: true,
            cursorStyle: isReadOnly ? 'underline' : 'line',
          }}
          onChange={(value) => {
            if (!isReadOnly) setSource(value ?? '');
          }}
          onMount={handleEditorMount}
          theme="javascope-dark"
        />
      </div>

      {/* Compile error panel */}
      {trace?.status === 'compile_error' && trace.compileErrors.length > 0 && (
        <div className="max-h-36 overflow-y-auto border-t border-red-500/30 bg-red-950/30">
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-red-400">
            Compile Errors
          </div>
          <ul className="space-y-0.5 pb-2">
            {trace.compileErrors.map((err, i) => (
              <li key={i} className="flex gap-2 px-3 py-0.5 text-xs text-red-300">
                <span className="shrink-0 font-mono text-red-400">
                  L{err.line}:{err.column}
                </span>
                <span>{err.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
