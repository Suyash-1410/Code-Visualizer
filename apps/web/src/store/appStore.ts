/**
 * JavaScope Zustand store.
 *
 * State shape:
 *  - source           : current editor content
 *  - trace            : validated Trace, or null
 *  - currentStepIndex : index into trace.steps
 *  - runState         : idle | running | ready | error
 *  - error            : user-visible error message
 *  - playback         : { isPlaying, speed }
 *  - selectedFrameId  : number | null
 *  - hoveredHeapId    : string | null
 *  - focusedHeapId    : string | null
 *
 * Derived selectors (hooks):
 *  - useCurrentStep()   → Step | undefined
 *  - useCurrentStdout() → string
 *  - useSelectedFrame() → StackFrame | undefined
 *  - useStepDiff()      → StepDiff
 */

import { create } from 'zustand';
import type { Trace, Step, StackFrame } from '../trace';
import { getStep, getVisibleStdout } from '../trace';
import { computeStepDiff, type StepDiff } from '../visualizer/diff';

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

  // Selection & Interactions (Stage 9 & Phase 2 Stage 5)
  selectedFrameId: number | null;
  hoveredHeapId: string | null;
  focusedHeapId: string | null;
  hoveredFrameId: number | null;
  hoveredVariableName: string | null;

  // Visualization settings (Phase 2 Stage 4)
  showGhostNodes: boolean;

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

  // Selection actions
  setSelectedFrameId: (frameId: number | null) => void;
  setHoveredHeapId: (id: string | null) => void;
  setFocusedHeapId: (id: string | null) => void;
  setHoveredFrameId: (frameId: number | null) => void;
  setHoveredVariableName: (name: string | null) => void;

  // Visualization settings
  setShowGhostNodes: (show: boolean) => void;
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
  selectedFrameId: null,
  hoveredHeapId: null,
  focusedHeapId: null,
  hoveredFrameId: null,
  hoveredVariableName: null,
  showGhostNodes: true,

  setSource: (source) => set({ source }),
  setShowGhostNodes: (showGhostNodes) => set({ showGhostNodes }),

  startRun: () =>
    set({
      runState: 'running',
      error: null,
      trace: null,
      currentStepIndex: 0,
      playback: { isPlaying: false, speed: get().playback.speed },
      selectedFrameId: null,
      hoveredHeapId: null,
      focusedHeapId: null,
      hoveredFrameId: null,
      hoveredVariableName: null,
    }),

  setTrace: (trace) =>
    set({
      trace,
      currentStepIndex: 0,
      runState: 'ready',
      error: null,
      selectedFrameId: null,
      hoveredHeapId: null,
      focusedHeapId: null,
      hoveredFrameId: null,
      hoveredVariableName: null,
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
      selectedFrameId: null,
      hoveredHeapId: null,
      focusedHeapId: null,
      hoveredFrameId: null,
      hoveredVariableName: null,
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

  setSelectedFrameId: (selectedFrameId) => set({ selectedFrameId }),
  setHoveredHeapId: (hoveredHeapId) => set({ hoveredHeapId }),
  setFocusedHeapId: (focusedHeapId) => set({ focusedHeapId }),
  setHoveredFrameId: (hoveredFrameId) => set({ hoveredFrameId }),
  setHoveredVariableName: (hoveredVariableName) => set({ hoveredVariableName }),
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

export function useSelectedFrame(): StackFrame | undefined {
  return useAppStore((s) => {
    if (!s.trace) return undefined;
    const step = getStep(s.trace, s.currentStepIndex);
    if (!step || step.stack.length === 0) return undefined;
    if (s.selectedFrameId !== null) {
      const match = step.stack.find((f) => f.frameId === s.selectedFrameId);
      if (match) return match;
    }
    // Default: top frame
    return step.stack[step.stack.length - 1];
  });
}

const EMPTY_DIFF: StepDiff = {
  changedLocals: new Map(),
  changedHeap: new Map(),
};

export function useStepDiff(): StepDiff {
  return useAppStore((s) => {
    if (!s.trace) return EMPTY_DIFF;
    const curr = getStep(s.trace, s.currentStepIndex);
    if (!curr) return EMPTY_DIFF;
    const prev =
      s.currentStepIndex > 0 ? getStep(s.trace, s.currentStepIndex - 1) : undefined;
    return computeStepDiff(prev, curr);
  });
}
