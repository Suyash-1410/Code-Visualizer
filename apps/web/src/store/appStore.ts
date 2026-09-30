/**
 * JavaScope Zustand store.
 *
 * State shape:
 *  - source        : current editor content
 *  - trace         : validated Trace, or null
 *  - currentStepIndex : index into trace.steps
 *  - runState      : idle | running | ready | error
 *  - error         : user-visible error message
 *  - playback      : { isPlaying, speed }
 *
 * Derived selectors (hooks):
 *  - useCurrentStep()   → Step | undefined
 *  - useCurrentStdout() → string
 */

import { create } from 'zustand';
import type { Trace, Step } from '../trace';
import { getStep, getVisibleStdout } from '../trace';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RunState = 'idle' | 'running' | 'ready' | 'error';

export interface PlaybackState {
  isPlaying: boolean;
  /** Steps per second during auto-play. */
  speed: number;
}

interface AppState {
  // Editor
  source: string;

  // Trace output
  trace: Trace | null;

  // Navigation
  currentStepIndex: number;

  // Run lifecycle
  runState: RunState;
  error: string | null;

  // Playback
  playback: PlaybackState;

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  setSource: (source: string) => void;

  /** Called when the user clicks Run / presses Ctrl+Enter. */
  startRun: () => void;

  /** Called when the API call succeeds with a validated trace. */
  setTrace: (trace: Trace) => void;

  /** Called on any failure (network, validation, etc.). */
  setError: (message: string) => void;

  /** Clears the trace and returns to editing mode. */
  clearTrace: () => void;

  // Step navigation
  setStepIndex: (index: number) => void;
  stepForward: () => void;
  stepBackward: () => void;
  goToStart: () => void;
  goToEnd: () => void;

  // Playback
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const DEFAULT_SOURCE = `public class Main {
    public static void main(String[] args) {
        int a = 10;
        int b = 20;
        int sum = a + b;
        System.out.println("sum=" + sum);
    }
}
`;

export const useAppStore = create<AppState>((set, get) => ({
  source: DEFAULT_SOURCE,
  trace: null,
  currentStepIndex: 0,
  runState: 'idle',
  error: null,
  playback: { isPlaying: false, speed: 1 },

  setSource: (source) => set({ source }),

  startRun: () =>
    set({
      runState: 'running',
      error: null,
      trace: null,
      currentStepIndex: 0,
      playback: { isPlaying: false, speed: get().playback.speed },
    }),

  setTrace: (trace) =>
    set({
      trace,
      currentStepIndex: 0,
      runState: 'ready',
      error: null,
    }),

  setError: (message) =>
    set({
      runState: 'error',
      error: message,
      trace: null,
    }),

  clearTrace: () =>
    set({
      trace: null,
      currentStepIndex: 0,
      runState: 'idle',
      error: null,
      playback: { isPlaying: false, speed: get().playback.speed },
    }),

  setStepIndex: (index) => {
    const { trace } = get();
    if (!trace) return;
    const clamped = Math.max(0, Math.min(index, trace.steps.length - 1));
    set({ currentStepIndex: clamped });
  },

  stepForward: () => {
    const { trace, currentStepIndex } = get();
    if (!trace) return;
    const next = Math.min(currentStepIndex + 1, trace.steps.length - 1);
    set({ currentStepIndex: next });
  },

  stepBackward: () => {
    const { currentStepIndex } = get();
    set({ currentStepIndex: Math.max(0, currentStepIndex - 1) });
  },

  goToStart: () => set({ currentStepIndex: 0 }),

  goToEnd: () => {
    const { trace } = get();
    if (!trace) return;
    set({ currentStepIndex: trace.steps.length - 1 });
  },

  setPlaying: (isPlaying) =>
    set((s) => ({ playback: { ...s.playback, isPlaying } })),

  setSpeed: (speed) =>
    set((s) => ({ playback: { ...s.playback, speed } })),
}));

// ---------------------------------------------------------------------------
// Derived selectors (stable references — call as hooks in components)
// ---------------------------------------------------------------------------

export function useCurrentStep(): Step | undefined {
  return useAppStore((s) =>
    s.trace ? getStep(s.trace, s.currentStepIndex) : undefined,
  );
}

export function useCurrentStdout(): string {
  return useAppStore((s) =>
    s.trace ? getVisibleStdout(s.trace, s.currentStepIndex) : '',
  );
}
