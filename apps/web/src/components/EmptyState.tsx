/**
 * EmptyState — Welcome guide, quick example buttons, and collapsible
 * supported features & limits guide (PRD 4.1 & 4.9).
 */

import React from 'react';
import { useAppStore } from '../store';
import { EXAMPLES, type ExampleProgram } from '../examples';

export const EmptyState: React.FC = () => {
  const setSource = useAppStore((s) => s.setSource);
  const clearTrace = useAppStore((s) => s.clearTrace);

  const handleSelectExample = (ex: ExampleProgram) => {
    clearTrace();
    setSource(ex.code);
  };

  const featured = EXAMPLES.filter((e) =>
    ['sum-of-array', 'fibonacci', 'binary-search', 'tower-of-hanoi'].includes(e.id),
  );

  return (
    <div
      data-testid="empty-state-guide"
      className="flex h-full flex-col overflow-y-auto bg-canvas p-6 text-gray-300"
    >
      <div className="mx-auto max-w-xl space-y-6">
        {/* Welcome Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-white">
              Welcome to Java<span className="text-blue-400">Scope</span>
            </span>
            <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-blue-400">
              Interactive
            </span>
          </div>
          <p className="text-xs leading-relaxed text-gray-400">
            JavaScope is a step-by-step visualizer for Java code execution.
            Watch memory updates in real time, inspect stack frames and heap
            objects, and explore recursion as a clean, interactive call tree.
          </p>
        </div>

        {/* Quick Example Loaders */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
            Quick Start Examples (Click to Load)
          </span>
          <div className="grid grid-cols-2 gap-2">
            {featured.map((ex) => (
              <button
                key={ex.id}
                type="button"
                onClick={() => handleSelectExample(ex)}
                className="group flex flex-col items-start rounded-lg border border-white/10 bg-canvas-subtle p-3 text-left transition-all hover:border-blue-500/50 hover:bg-blue-950/20"
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-gray-200 group-hover:text-blue-300">
                    {ex.title}
                  </span>
                  <span className="text-[10px] text-gray-500 group-hover:text-blue-400">
                    Load →
                  </span>
                </div>
                <span className="mt-1 line-clamp-2 text-[11px] text-gray-400">
                  {ex.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Supported Subset & Limits Collapsible (PRD Sections 3 & 8) */}
        <details className="group rounded-lg border border-white/10 bg-canvas-subtle text-xs">
          <summary className="flex cursor-pointer select-none items-center justify-between p-3 font-semibold text-gray-300 transition-colors hover:text-white">
            <span className="flex items-center gap-2">
              <span>ℹ</span> What&apos;s Supported &amp; System Limits
            </span>
            <span className="text-xs text-gray-500 transition-transform group-open:rotate-180">
              ▼
            </span>
          </summary>
          <div className="space-y-4 border-t border-white/8 p-3 text-[11px] leading-relaxed text-gray-400">
            {/* Supported */}
            <div>
              <span className="font-semibold text-emerald-400">
                ✔ Supported Java Subset:
              </span>
              <ul className="mt-1 list-inside list-disc space-y-0.5 pl-1">
                <li>Java 21 single-file source with standard entry point</li>
                <li>Primitives, Strings, 1D and 2D arrays</li>
                <li>Classes, constructors, fields, methods, inheritance &amp; overriding</li>
                <li>Recursion, call stacks, and return values</li>
                <li>System.out.print, println, printf</li>
                <li>Exception throwing and catching</li>
              </ul>
            </div>

            {/* Unsupported */}
            <div>
              <span className="font-semibold text-amber-400">
                ⊘ Explicitly Unsupported:
              </span>
              <ul className="mt-1 list-inside list-disc space-y-0.5 pl-1">
                <li>Multithreading (Thread, ExecutorService)</li>
                <li>Interactive input (Scanner, System.in)</li>
                <li>File I/O, network sockets, reflection, JNI</li>
                <li>Graphical user interfaces (Swing, AWT, JavaFX)</li>
              </ul>
            </div>

            {/* Limits */}
            <div>
              <span className="font-semibold text-blue-400">
                ⚙ Execution Limits (PRD Section 8):
              </span>
              <ul className="mt-1 list-inside list-disc space-y-0.5 pl-1">
                <li>Step cap: <strong>7,000 steps</strong> max per run</li>
                <li>Execution timeout: <strong>5 seconds</strong> wall clock</li>
                <li>Recursion depth: <strong>200 frames</strong> maximum</li>
                <li>Sandbox memory: <strong>512 MB</strong></li>
              </ul>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
};
