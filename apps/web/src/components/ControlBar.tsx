/**
 * ControlBar — full playback controls (PRD 4.2).
 *
 * All controls are driven by a single currentStepIndex from the store.
 * Keyboard shortcuts are registered in the App-level useKeyboardShortcuts hook.
 */

import React from 'react';
import { useAppStore } from '../store';
import { usePlayback } from '../hooks/usePlayback';

const SPEEDS = [0.25, 0.5, 1, 2, 4] as const;

export const ControlBar: React.FC = () => {
  const runState = useAppStore((s) => s.runState);
  const trace = useAppStore((s) => s.trace);
  const currentStepIndex = useAppStore((s) => s.currentStepIndex);

  const {
    isPlaying,
    speed,
    totalSteps,
    play,
    pause,
    stepForward,
    stepBackward,
    restart,
    jumpToEnd,
    stepOver,
    stepOut,
    setSpeed,
    setStepIndex,
  } = usePlayback();

  const isReady = runState === 'ready' && totalSteps > 0;
  const atStart = currentStepIndex === 0;
  const atEnd = currentStepIndex >= totalSteps - 1;

  // ── Not ready ─────────────────────────────────────────────────────────────
  if (!isReady) {
    return (
      <div className="flex h-12 shrink-0 items-center justify-center border-t border-white/8 bg-canvas-subtle text-xs text-gray-600">
        {runState === 'running'
          ? 'Running…'
          : 'Run a program to start stepping.'}
      </div>
    );
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-12 shrink-0 items-center gap-1.5 border-t border-white/8 bg-canvas-subtle px-3">
      {/* ── Navigation cluster ── */}

      {/* Restart ⏮ */}
      <CtrlBtn
        onClick={restart}
        disabled={atStart}
        title="Restart (Home)"
        aria-label="Restart"
      >
        ⏮
      </CtrlBtn>

      {/* Step Back ◀ */}
      <CtrlBtn
        onClick={stepBackward}
        disabled={atStart}
        title="Step back (←)"
        aria-label="Step back"
      >
        ◀
      </CtrlBtn>

      {/* Play / Pause */}
      <button
        onClick={isPlaying ? pause : play}
        disabled={!isPlaying && atEnd}
        className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? '⏸ Pause' : '▶ Play'}
      </button>

      {/* Step Forward ▶ */}
      <CtrlBtn
        onClick={stepForward}
        disabled={atEnd}
        title="Step forward (→)"
        aria-label="Step forward"
      >
        ▶
      </CtrlBtn>

      {/* Jump to End ⏭ */}
      <CtrlBtn
        onClick={jumpToEnd}
        disabled={atEnd}
        title="Jump to end (End)"
        aria-label="Jump to end"
      >
        ⏭
      </CtrlBtn>

      {/* ── Separator ── */}
      <div className="mx-1 h-5 w-px bg-white/10" />

      {/* ── Step Over / Step Out ── */}
      <CtrlBtn
        onClick={stepOver}
        disabled={atEnd}
        title="Step over (skip function calls on this line)"
        aria-label="Step over"
        className="text-[10px]"
      >
        ↷ Over
      </CtrlBtn>

      <CtrlBtn
        onClick={stepOut}
        disabled={atEnd}
        title="Step out (run until current function returns)"
        aria-label="Step out"
        className="text-[10px]"
      >
        ↑ Out
      </CtrlBtn>

      {/* ── Separator ── */}
      <div className="mx-1 h-5 w-px bg-white/10" />

      {/* ── Timeline scrubber ── */}
      <input
        type="range"
        min={0}
        max={totalSteps - 1}
        value={currentStepIndex}
        onChange={(e) => {
          if (isPlaying) pause();
          setStepIndex(Number(e.target.value));
        }}
        className="w-40 flex-shrink-0 accent-blue-500 sm:flex-1"
        aria-label="Timeline scrubber"
        title={`Step ${String(currentStepIndex + 1)} of ${String(totalSteps)}`}
      />

      {/* ── Step counter ── */}
      <span
        className="shrink-0 min-w-[5rem] text-center text-xs tabular-nums text-gray-400"
        aria-live="polite"
        aria-atomic="true"
      >
        Step {currentStepIndex + 1} of {totalSteps}
      </span>

      {/* ── Speed selector ── */}
      <label className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
        ×
        <select
          value={speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="rounded bg-canvas-muted px-1 py-0.5 text-gray-300 focus:outline-none"
          aria-label="Playback speed"
        >
          {SPEEDS.map((s) => (
            <option key={s} value={s}>
              {s}x
            </option>
          ))}
        </select>
      </label>

      {/* Event badge */}
      {trace && (
        <EventBadge event={trace.steps[currentStepIndex]?.event} />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface CtrlBtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const CtrlBtn: React.FC<CtrlBtnProps> = ({ children, className = '', ...props }) => (
  <button
    {...props}
    className={`rounded px-1.5 py-1 text-sm text-gray-300 hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:opacity-30 ${className}`}
  >
    {children}
  </button>
);

const EVENT_COLORS: Record<string, string> = {
  call: 'text-blue-400 bg-blue-400/10 border-blue-400/30',
  return: 'text-purple-400 bg-purple-400/10 border-purple-400/30',
  line: 'text-gray-400 bg-white/5 border-white/10',
  exception: 'text-red-400 bg-red-400/10 border-red-400/30',
  end: 'text-gray-500 bg-white/5 border-white/10',
};

const EventBadge: React.FC<{ event?: string }> = ({ event }) => {
  if (!event) return null;
  return (
    <span
      className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${EVENT_COLORS[event] ?? EVENT_COLORS.line}`}
    >
      {event}
    </span>
  );
};
