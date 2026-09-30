/**
 * ControlBar — bottom bar with step navigation and playback controls.
 *
 * This is the placeholder for Stage 7. Full playback logic (auto-play timer)
 * comes with the full visualization in a later stage.
 */

import React, { useEffect, useRef } from 'react';
import { useAppStore } from '../store';

export const ControlBar: React.FC = () => {
  const trace = useAppStore((s) => s.trace);
  const currentStepIndex = useAppStore((s) => s.currentStepIndex);
  const runState = useAppStore((s) => s.runState);
  const playback = useAppStore((s) => s.playback);
  const stepForward = useAppStore((s) => s.stepForward);
  const stepBackward = useAppStore((s) => s.stepBackward);
  const goToStart = useAppStore((s) => s.goToStart);
  const goToEnd = useAppStore((s) => s.goToEnd);
  const setStepIndex = useAppStore((s) => s.setStepIndex);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const setSpeed = useAppStore((s) => s.setSpeed);

  const stepCount = trace?.steps.length ?? 0;
  const isReady = runState === 'ready' && stepCount > 0;

  // Auto-play timer
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isReady || !playback.isPlaying) {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const intervalMs = Math.round(1000 / playback.speed);
    timerRef.current = setInterval(() => {
      const { currentStepIndex: idx, trace: t } = useAppStore.getState();
      if (!t || idx >= t.steps.length - 1) {
        setPlaying(false);
        return;
      }
      stepForward();
    }, intervalMs);

    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, [isReady, playback.isPlaying, playback.speed, stepForward, setPlaying]);

  if (!isReady) {
    return (
      <div className="flex h-12 items-center justify-center border-t border-white/8 bg-canvas-subtle text-xs text-gray-600">
        {runState === 'running'
          ? 'Running…'
          : 'Run a program to start stepping.'}
      </div>
    );
  }

  const pct = stepCount > 1 ? (currentStepIndex / (stepCount - 1)) * 100 : 100;

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-t border-white/8 bg-canvas-subtle px-4">
      {/* Navigation buttons */}
      <button
        onClick={goToStart}
        disabled={currentStepIndex === 0}
        className="rounded p-1 text-gray-400 hover:text-white disabled:opacity-30"
        title="Go to start"
      >
        ⏮
      </button>
      <button
        onClick={stepBackward}
        disabled={currentStepIndex === 0}
        className="rounded p-1 text-gray-400 hover:text-white disabled:opacity-30"
        title="Step back"
      >
        ◀
      </button>

      {/* Play / Pause */}
      <button
        onClick={() => setPlaying(!playback.isPlaying)}
        className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500"
        title={playback.isPlaying ? 'Pause' : 'Play'}
      >
        {playback.isPlaying ? '⏸ Pause' : '▶ Play'}
      </button>

      <button
        onClick={stepForward}
        disabled={currentStepIndex >= stepCount - 1}
        className="rounded p-1 text-gray-400 hover:text-white disabled:opacity-30"
        title="Step forward"
      >
        ▶
      </button>
      <button
        onClick={goToEnd}
        disabled={currentStepIndex >= stepCount - 1}
        className="rounded p-1 text-gray-400 hover:text-white disabled:opacity-30"
        title="Go to end"
      >
        ⏭
      </button>

      {/* Scrubber */}
      <input
        type="range"
        min={0}
        max={stepCount - 1}
        value={currentStepIndex}
        onChange={(e) => setStepIndex(Number(e.target.value))}
        className="flex-1 accent-blue-500"
        title="Scrub steps"
      />

      {/* Step counter */}
      <span className="shrink-0 text-xs tabular-nums text-gray-400">
        {currentStepIndex + 1} / {stepCount}
      </span>

      {/* Speed selector */}
      <label className="flex items-center gap-1 text-xs text-gray-400">
        ×
        <select
          value={playback.speed}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="bg-canvas-muted text-gray-300 focus:outline-none"
        >
          {[0.25, 0.5, 1, 2, 4].map((s) => (
            <option key={s} value={s}>
              {String(s)}
            </option>
          ))}
        </select>
      </label>

      {/* Progress indicator */}
      <div className="h-1 w-16 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-blue-500 transition-all"
          style={{ width: `${String(pct)}%` }}
        />
      </div>
    </div>
  );
};
