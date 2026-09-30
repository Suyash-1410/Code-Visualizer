/**
 * StdoutPanel — shows the portion of stdout visible at the current step.
 *
 * Uses getVisibleStdout(trace, currentStepIndex), which slices trace.stdout
 * up to step.stdoutLen. Stepping backward naturally removes text because
 * the earlier step has a smaller stdoutLen.
 */

import React from 'react';
import { useAppStore, useCurrentStdout } from '../../store';

export const StdoutPanel: React.FC = () => {
  const trace = useAppStore((s) => s.trace);
  const currentStepIndex = useAppStore((s) => s.currentStepIndex);
  const stdout = useCurrentStdout();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-white/8 px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Output
        </span>
        {trace && (
          <span className="text-[10px] tabular-nums text-gray-600">
            {stdout.length} / {trace.stdout.length} chars
          </span>
        )}
      </div>

      {/* Content */}
      {!trace ? (
        <div className="flex flex-1 items-center justify-center text-xs text-gray-600">
          Output will appear here.
        </div>
      ) : stdout.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-gray-600">
          {currentStepIndex === 0
            ? 'No output yet.'
            : 'No output at this step.'}
        </div>
      ) : (
        <pre className="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed text-emerald-300">
          {stdout}
        </pre>
      )}
    </div>
  );
};
