/**
 * usePlayback — wraps the Zustand store with playback actions and a timer.
 *
 * Single responsibility:
 *  - Owns the auto-play setInterval, cleaning it up on unmount.
 *  - Exposes a stable set of actions (play, pause, stepForward, etc.).
 *  - Derived actions (stepOver, stepOut, jumpToLine) compute jump targets
 *    from the trace and then call setStepIndex.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import {
  findStepOver,
  findStepOut,
  findStepForLine,
} from '../playback/stepNavigation';

export function usePlayback() {
  const trace = useAppStore((s) => s.trace);
  const isPlaying = useAppStore((s) => s.playback.isPlaying);
  const speed = useAppStore((s) => s.playback.speed);
  const currentStepIndex = useAppStore((s) => s.currentStepIndex);

  // Store actions (stable refs from Zustand)
  const setStepIndex = useAppStore((s) => s.setStepIndex);
  const storeSf = useAppStore((s) => s.stepForward);
  const storeSb = useAppStore((s) => s.stepBackward);
  const goToStart = useAppStore((s) => s.goToStart);
  const goToEnd = useAppStore((s) => s.goToEnd);
  const setPlaying = useAppStore((s) => s.setPlaying);
  const setSpeed = useAppStore((s) => s.setSpeed);

  // ------------------------------------------------------------------
  // Auto-play timer
  // ------------------------------------------------------------------
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearTimer();
    if (!trace || !isPlaying) return;

    const intervalMs = Math.max(50, Math.round(1000 / speed));
    timerRef.current = setInterval(() => {
      // Read latest state directly to avoid stale closures
      const store = useAppStore.getState();
      if (!store.trace || !store.playback.isPlaying) {
        clearTimer();
        return;
      }
      if (store.currentStepIndex >= store.trace.steps.length - 1) {
        store.setPlaying(false);
        clearTimer();
        return;
      }
      store.stepForward();
    }, intervalMs);

    // Clean up on unmount or when playing/speed changes
    return clearTimer;
  }, [trace, isPlaying, speed, clearTimer]);

  // ------------------------------------------------------------------
  // Actions
  // ------------------------------------------------------------------

  const play = useCallback(() => {
    if (!trace) return;
    if (currentStepIndex >= trace.steps.length - 1) return;
    setPlaying(true);
  }, [trace, currentStepIndex, setPlaying]);

  const pause = useCallback(() => setPlaying(false), [setPlaying]);

  const togglePlay = useCallback(() => {
    if (!trace) return;
    if (isPlaying) {
      setPlaying(false);
    } else if (currentStepIndex < trace.steps.length - 1) {
      setPlaying(true);
    }
  }, [trace, isPlaying, currentStepIndex, setPlaying]);

  // Manual step also pauses auto-play
  const stepForward = useCallback(() => {
    setPlaying(false);
    storeSf();
  }, [setPlaying, storeSf]);

  const stepBackward = useCallback(() => {
    setPlaying(false);
    storeSb();
  }, [setPlaying, storeSb]);

  const restart = useCallback(() => {
    setPlaying(false);
    goToStart();
  }, [setPlaying, goToStart]);

  const jumpToEnd = useCallback(() => {
    setPlaying(false);
    goToEnd();
  }, [setPlaying, goToEnd]);

  const stepOver = useCallback(() => {
    if (!trace) return;
    setPlaying(false);
    const target = findStepOver(trace.steps, currentStepIndex);
    setStepIndex(target);
  }, [trace, currentStepIndex, setPlaying, setStepIndex]);

  const stepOut = useCallback(() => {
    if (!trace) return;
    setPlaying(false);
    const target = findStepOut(trace.steps, currentStepIndex);
    setStepIndex(target);
  }, [trace, currentStepIndex, setPlaying, setStepIndex]);

  const jumpToLine = useCallback(
    (lineNumber: number) => {
      if (!trace) return;
      setPlaying(false);
      const target = findStepForLine(trace.steps, lineNumber);
      if (target >= 0) setStepIndex(target);
    },
    [trace, setPlaying, setStepIndex],
  );

  return {
    // State
    isPlaying,
    speed,
    currentStepIndex,
    totalSteps: trace?.steps.length ?? 0,
    // Actions
    play,
    pause,
    togglePlay,
    stepForward,
    stepBackward,
    restart,
    jumpToEnd,
    stepOver,
    stepOut,
    setSpeed,
    jumpToLine,
    // Pass-through for components that need store actions directly
    setStepIndex,
  };
}
