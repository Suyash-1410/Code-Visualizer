/**
 * Tests for the pure playback state machine reducer.
 */

import { describe, it, expect } from 'vitest';
import {
  playbackReducer,
  type PlaybackReducerState,
  type PlaybackReducerAction,
} from '../reducer';

function makeState(
  overrides: Partial<PlaybackReducerState> = {},
): PlaybackReducerState {
  return {
    isPlaying: false,
    speed: 1,
    currentStepIndex: 0,
    totalSteps: 10,
    ...overrides,
  };
}

function dispatch(
  state: PlaybackReducerState,
  action: PlaybackReducerAction,
): PlaybackReducerState {
  return playbackReducer(state, action);
}

describe('playbackReducer — PLAY', () => {
  it('starts playing from middle', () => {
    const s = dispatch(makeState({ currentStepIndex: 5 }), { type: 'PLAY' });
    expect(s.isPlaying).toBe(true);
  });

  it('does not play when already at last step', () => {
    const s = dispatch(makeState({ currentStepIndex: 9 }), { type: 'PLAY' });
    expect(s.isPlaying).toBe(false);
  });

  it('does not play when totalSteps is 0', () => {
    const s = dispatch(makeState({ totalSteps: 0 }), { type: 'PLAY' });
    expect(s.isPlaying).toBe(false);
  });
});

describe('playbackReducer — PAUSE', () => {
  it('pauses while playing', () => {
    const s = dispatch(makeState({ isPlaying: true }), { type: 'PAUSE' });
    expect(s.isPlaying).toBe(false);
  });

  it('is a no-op when already paused', () => {
    const s = dispatch(makeState({ isPlaying: false }), { type: 'PAUSE' });
    expect(s.isPlaying).toBe(false);
  });
});

describe('playbackReducer — TOGGLE_PLAY', () => {
  it('starts playing when paused in middle', () => {
    const s = dispatch(makeState({ currentStepIndex: 3 }), {
      type: 'TOGGLE_PLAY',
    });
    expect(s.isPlaying).toBe(true);
  });

  it('pauses when playing', () => {
    const s = dispatch(makeState({ isPlaying: true, currentStepIndex: 3 }), {
      type: 'TOGGLE_PLAY',
    });
    expect(s.isPlaying).toBe(false);
  });

  it('does not start when at last step', () => {
    const s = dispatch(makeState({ currentStepIndex: 9 }), {
      type: 'TOGGLE_PLAY',
    });
    expect(s.isPlaying).toBe(false);
  });

  it('does nothing when no steps', () => {
    const s = dispatch(makeState({ totalSteps: 0 }), { type: 'TOGGLE_PLAY' });
    expect(s.isPlaying).toBe(false);
  });
});

describe('playbackReducer — STEP_FORWARD', () => {
  it('advances index', () => {
    const s = dispatch(makeState({ currentStepIndex: 3 }), {
      type: 'STEP_FORWARD',
    });
    expect(s.currentStepIndex).toBe(4);
    expect(s.isPlaying).toBe(false);
  });

  it('clamps at last step', () => {
    const s = dispatch(makeState({ currentStepIndex: 9 }), {
      type: 'STEP_FORWARD',
    });
    expect(s.currentStepIndex).toBe(9);
  });

  it('pauses playback', () => {
    const s = dispatch(makeState({ isPlaying: true, currentStepIndex: 3 }), {
      type: 'STEP_FORWARD',
    });
    expect(s.isPlaying).toBe(false);
    expect(s.currentStepIndex).toBe(4);
  });
});

describe('playbackReducer — STEP_BACKWARD', () => {
  it('retreats index', () => {
    const s = dispatch(makeState({ currentStepIndex: 5 }), {
      type: 'STEP_BACKWARD',
    });
    expect(s.currentStepIndex).toBe(4);
    expect(s.isPlaying).toBe(false);
  });

  it('clamps at 0', () => {
    const s = dispatch(makeState({ currentStepIndex: 0 }), {
      type: 'STEP_BACKWARD',
    });
    expect(s.currentStepIndex).toBe(0);
  });

  it('pauses playback', () => {
    const s = dispatch(makeState({ isPlaying: true, currentStepIndex: 5 }), {
      type: 'STEP_BACKWARD',
    });
    expect(s.isPlaying).toBe(false);
  });
});

describe('playbackReducer — JUMP', () => {
  it('jumps to a valid index', () => {
    const s = dispatch(makeState(), { type: 'JUMP', index: 7 });
    expect(s.currentStepIndex).toBe(7);
    expect(s.isPlaying).toBe(false);
  });

  it('clamps high values to last step', () => {
    const s = dispatch(makeState(), { type: 'JUMP', index: 999 });
    expect(s.currentStepIndex).toBe(9);
  });

  it('clamps negative to 0', () => {
    const s = dispatch(makeState(), { type: 'JUMP', index: -5 });
    expect(s.currentStepIndex).toBe(0);
  });
});

describe('playbackReducer — TICK', () => {
  it('advances on each tick while playing', () => {
    const s = dispatch(makeState({ isPlaying: true, currentStepIndex: 4 }), {
      type: 'TICK',
    });
    expect(s.currentStepIndex).toBe(5);
    expect(s.isPlaying).toBe(true);
  });

  it('auto-pauses at the last step', () => {
    // currentStepIndex=8, totalSteps=10 → tick advances to 9 (last), still playing
    const s1 = dispatch(makeState({ isPlaying: true, currentStepIndex: 8 }), {
      type: 'TICK',
    });
    expect(s1.currentStepIndex).toBe(9);
    expect(s1.isPlaying).toBe(true); // still playing, just reached last step

    // One more tick from last step (9) → auto-pauses, stays at 9
    const s2 = dispatch(makeState({ isPlaying: true, currentStepIndex: 9 }), {
      type: 'TICK',
    });
    expect(s2.currentStepIndex).toBe(9);
    expect(s2.isPlaying).toBe(false);
  });


  it('is a no-op when paused', () => {
    const s = dispatch(makeState({ isPlaying: false, currentStepIndex: 4 }), {
      type: 'TICK',
    });
    expect(s.currentStepIndex).toBe(4);
  });

  it('auto-pauses when already at last step on tick', () => {
    const s = dispatch(makeState({ isPlaying: true, currentStepIndex: 9 }), {
      type: 'TICK',
    });
    expect(s.isPlaying).toBe(false);
    expect(s.currentStepIndex).toBe(9);
  });
});

describe('playbackReducer — GO_TO_START / GO_TO_END', () => {
  it('GO_TO_START resets to 0 and pauses', () => {
    const s = dispatch(
      makeState({ isPlaying: true, currentStepIndex: 7 }),
      { type: 'GO_TO_START' },
    );
    expect(s.currentStepIndex).toBe(0);
    expect(s.isPlaying).toBe(false);
  });

  it('GO_TO_END goes to last step and pauses', () => {
    const s = dispatch(
      makeState({ isPlaying: true, currentStepIndex: 0 }),
      { type: 'GO_TO_END' },
    );
    expect(s.currentStepIndex).toBe(9);
    expect(s.isPlaying).toBe(false);
  });
});

describe('playbackReducer — SET_SPEED', () => {
  it('updates speed without affecting playback', () => {
    const s = dispatch(makeState({ isPlaying: true }), {
      type: 'SET_SPEED',
      speed: 4,
    });
    expect(s.speed).toBe(4);
    expect(s.isPlaying).toBe(true);
  });
});

describe('playbackReducer — RESET', () => {
  it('resets index to 0 and pauses, preserving speed', () => {
    const s = dispatch(
      makeState({ isPlaying: true, currentStepIndex: 7, speed: 2 }),
      { type: 'RESET', totalSteps: 5 },
    );
    expect(s.currentStepIndex).toBe(0);
    expect(s.isPlaying).toBe(false);
    expect(s.totalSteps).toBe(5);
    expect(s.speed).toBe(2);
  });
});
