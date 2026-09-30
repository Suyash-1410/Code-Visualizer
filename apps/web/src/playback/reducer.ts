/**
 * Pure playback state machine reducer.
 *
 * Entirely side-effect free — suitable for unit testing without any DOM,
 * React, or store setup. The hook (usePlayback) applies this logic to the
 * Zustand store and attaches the real timer.
 */

export interface PlaybackReducerState {
  isPlaying: boolean;
  speed: number; // steps per second
  currentStepIndex: number;
  totalSteps: number;
}

export type PlaybackReducerAction =
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'TOGGLE_PLAY' }
  | { type: 'STEP_FORWARD' }
  | { type: 'STEP_BACKWARD' }
  | { type: 'JUMP'; index: number }
  | { type: 'SET_SPEED'; speed: number }
  | { type: 'TICK' }
  | { type: 'GO_TO_START' }
  | { type: 'GO_TO_END' }
  | { type: 'RESET'; totalSteps: number };

export function playbackReducer(
  state: PlaybackReducerState,
  action: PlaybackReducerAction,
): PlaybackReducerState {
  const last = state.totalSteps > 0 ? state.totalSteps - 1 : 0;
  const atEnd = state.currentStepIndex >= last;

  switch (action.type) {
    case 'PLAY':
      // Don't play if already at the last step.
      if (atEnd || state.totalSteps === 0) return state;
      return { ...state, isPlaying: true };

    case 'PAUSE':
      return { ...state, isPlaying: false };

    case 'TOGGLE_PLAY':
      if (state.totalSteps === 0) return state;
      if (state.isPlaying) return { ...state, isPlaying: false };
      if (atEnd) return state; // can't play at end
      return { ...state, isPlaying: true };

    case 'STEP_FORWARD': {
      const next = Math.min(state.currentStepIndex + 1, last);
      // Stepping manually while playing → pause
      return { ...state, isPlaying: false, currentStepIndex: next };
    }

    case 'STEP_BACKWARD': {
      const prev = Math.max(state.currentStepIndex - 1, 0);
      return { ...state, isPlaying: false, currentStepIndex: prev };
    }

    case 'JUMP': {
      const clamped = Math.max(0, Math.min(action.index, last));
      return { ...state, isPlaying: false, currentStepIndex: clamped };
    }

    case 'SET_SPEED':
      return { ...state, speed: action.speed };

    case 'TICK': {
      if (!state.isPlaying || state.totalSteps === 0) return state;
      const next = state.currentStepIndex + 1;
      if (next >= state.totalSteps) {
        // Auto-pause at the last step
        return { ...state, isPlaying: false, currentStepIndex: last };
      }
      return { ...state, currentStepIndex: next };
    }

    case 'GO_TO_START':
      return { ...state, isPlaying: false, currentStepIndex: 0 };

    case 'GO_TO_END':
      return { ...state, isPlaying: false, currentStepIndex: last };

    case 'RESET':
      return {
        isPlaying: false,
        speed: state.speed,
        currentStepIndex: 0,
        totalSteps: action.totalSteps,
      };

    default:
      return state;
  }
}
