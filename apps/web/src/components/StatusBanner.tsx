/**
 * StatusBanner — shows runtime error, truncation notice, unsupported, or
 * internal error banners above the visualization area.
 * Final styling will come in Stage 12; this is functional.
 */

import React from 'react';
import { useAppStore } from '../store';

export const StatusBanner: React.FC = () => {
  const trace = useAppStore((s) => s.trace);
  const runState = useAppStore((s) => s.runState);
  const error = useAppStore((s) => s.error);

  // API / network error (no trace)
  if (runState === 'error' && error) {
    return (
      <div className="flex items-start gap-2 border-b border-red-500/30 bg-red-950/40 px-4 py-2 text-xs text-red-300">
        <span className="mt-0.5 text-base leading-none">✗</span>
        <span>{error}</span>
      </div>
    );
  }

  if (!trace) return null;

  switch (trace.status) {
    case 'runtime_error':
      return (
        <div className="flex items-start gap-2 border-b border-orange-500/30 bg-orange-950/30 px-4 py-2 text-xs text-orange-300">
          <span className="mt-0.5 shrink-0 text-base leading-none">⚠</span>
          <span>
            <strong>Runtime error:</strong>{' '}
            {trace.runtimeError
              ? `${trace.runtimeError.type}: ${trace.runtimeError.message} (line ${String(trace.runtimeError.line)})`
              : 'An unhandled exception occurred.'}
          </span>
        </div>
      );

    case 'truncated':
      return (
        <div className="flex items-start gap-2 border-b border-yellow-500/30 bg-yellow-950/20 px-4 py-2 text-xs text-yellow-300">
          <span className="mt-0.5 shrink-0 text-base leading-none">⏷</span>
          <span>
            <strong>Trace truncated</strong> at step{' '}
            {trace.truncation?.atStep ?? '?'} —{' '}
            {reasonLabel(trace.truncation?.reason)}
          </span>
        </div>
      );

    case 'unsupported':
      return (
        <div className="flex items-start gap-2 border-b border-purple-500/30 bg-purple-950/30 px-4 py-2 text-xs text-purple-300">
          <span className="mt-0.5 shrink-0 text-base leading-none">⊘</span>
          <span>
            <strong>Unsupported program:</strong> This program uses a feature
            JavaScope cannot visualise yet (e.g. multithreading, Scanner
            input).
          </span>
        </div>
      );

    case 'internal_error':
      return (
        <div className="flex items-start gap-2 border-b border-red-500/30 bg-red-950/40 px-4 py-2 text-xs text-red-300">
          <span className="mt-0.5 shrink-0 text-base leading-none">✗</span>
          <span>
            <strong>Internal error:</strong> The sandbox encountered an
            unexpected problem. Please try again.
          </span>
        </div>
      );

    default:
      return null;
  }
};

function reasonLabel(reason: string | undefined): string {
  switch (reason) {
    case 'step_cap':
      return 'step limit reached (7 000 steps max).';
    case 'time_limit':
      return 'wall-clock time limit exceeded (5 s max).';
    case 'depth_limit':
      return 'call depth limit reached (200 frames max).';
    case 'trace_size':
      return 'trace size limit exceeded (15 MB max).';
    default:
      return 'limit reached.';
  }
}
