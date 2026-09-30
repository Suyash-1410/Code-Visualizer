/**
 * Tests for the Zustand store: state transitions and derived selectors.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/appStore';
import type { Trace } from '../../trace';

// Minimal valid trace fixture for tests
const MINIMAL_TRACE: Trace = {
  schemaVersion: 1,
  status: 'ok',
  truncation: null,
  compileErrors: [],
  runtimeError: null,
  source: 'public class Main { public static void main(String[] a) {} }',
  stdout: 'hello\n',
  steps: [
    {
      i: 0,
      event: 'call',
      line: 1,
      stack: [
        {
          frameId: 1,
          method: 'main',
          signature: '([Ljava/lang/String;)V',
          line: 1,
          locals: [{ name: 'x', type: 'int', value: { k: 'prim', t: 'int', v: 42 } }],
        },
      ],
      heap: {},
      statics: [],
      returnValue: null,
      stdoutLen: 0,
      clipped: false,
    },
    {
      i: 1,
      event: 'line',
      line: 2,
      stack: [
        {
          frameId: 1,
          method: 'main',
          signature: '([Ljava/lang/String;)V',
          line: 2,
          locals: [{ name: 'x', type: 'int', value: { k: 'prim', t: 'int', v: 42 } }],
        },
      ],
      heap: {},
      statics: [],
      returnValue: null,
      stdoutLen: 6,
      clipped: false,
    },
    {
      i: 2,
      event: 'end',
      line: 3,
      stack: [],
      heap: {},
      statics: [],
      returnValue: null,
      stdoutLen: 6,
      clipped: false,
    },
  ],
  stats: { stepCount: 3, maxDepth: 1, durationMs: 100 },
};

// Reset store to initial state before each test
beforeEach(() => {
  useAppStore.setState({
    source: '',
    trace: null,
    currentStepIndex: 0,
    runState: 'idle',
    error: null,
    playback: { isPlaying: false, speed: 1 },
  });
});

describe('appStore — initial state', () => {
  it('starts in idle state with no trace', () => {
    const s = useAppStore.getState();
    expect(s.runState).toBe('idle');
    expect(s.trace).toBeNull();
    expect(s.currentStepIndex).toBe(0);
    expect(s.error).toBeNull();
  });
});

describe('appStore — startRun / setTrace / setError / clearTrace', () => {
  it('startRun sets state to running and clears error', () => {
    useAppStore.getState().setError('previous error');
    useAppStore.getState().startRun();
    const s = useAppStore.getState();
    expect(s.runState).toBe('running');
    expect(s.error).toBeNull();
    expect(s.trace).toBeNull();
    expect(s.currentStepIndex).toBe(0);
  });

  it('setTrace sets state to ready with trace', () => {
    useAppStore.getState().setTrace(MINIMAL_TRACE);
    const s = useAppStore.getState();
    expect(s.runState).toBe('ready');
    expect(s.trace).toBe(MINIMAL_TRACE);
    expect(s.currentStepIndex).toBe(0);
    expect(s.error).toBeNull();
  });

  it('setError sets state to error', () => {
    useAppStore.getState().setError('network failure');
    const s = useAppStore.getState();
    expect(s.runState).toBe('error');
    expect(s.error).toBe('network failure');
    expect(s.trace).toBeNull();
  });

  it('clearTrace returns to idle', () => {
    useAppStore.getState().setTrace(MINIMAL_TRACE);
    useAppStore.getState().setStepIndex(2);
    useAppStore.getState().clearTrace();
    const s = useAppStore.getState();
    expect(s.runState).toBe('idle');
    expect(s.trace).toBeNull();
    expect(s.currentStepIndex).toBe(0);
    expect(s.error).toBeNull();
    expect(s.playback.isPlaying).toBe(false);
  });
});

describe('appStore — step navigation', () => {
  beforeEach(() => {
    useAppStore.getState().setTrace(MINIMAL_TRACE);
  });

  it('stepForward advances index', () => {
    useAppStore.getState().stepForward();
    expect(useAppStore.getState().currentStepIndex).toBe(1);
  });

  it('stepForward clamps at last step', () => {
    useAppStore.getState().goToEnd();
    useAppStore.getState().stepForward();
    expect(useAppStore.getState().currentStepIndex).toBe(2);
  });

  it('stepBackward retreats index', () => {
    useAppStore.getState().setStepIndex(2);
    useAppStore.getState().stepBackward();
    expect(useAppStore.getState().currentStepIndex).toBe(1);
  });

  it('stepBackward clamps at 0', () => {
    useAppStore.getState().stepBackward();
    expect(useAppStore.getState().currentStepIndex).toBe(0);
  });

  it('goToEnd goes to last step', () => {
    useAppStore.getState().goToEnd();
    expect(useAppStore.getState().currentStepIndex).toBe(2);
  });

  it('goToStart returns to 0', () => {
    useAppStore.getState().goToEnd();
    useAppStore.getState().goToStart();
    expect(useAppStore.getState().currentStepIndex).toBe(0);
  });

  it('setStepIndex clamps out-of-range values', () => {
    useAppStore.getState().setStepIndex(999);
    expect(useAppStore.getState().currentStepIndex).toBe(2);
    useAppStore.getState().setStepIndex(-5);
    expect(useAppStore.getState().currentStepIndex).toBe(0);
  });
});

describe('appStore — playback', () => {
  it('setPlaying toggles isPlaying', () => {
    useAppStore.getState().setPlaying(true);
    expect(useAppStore.getState().playback.isPlaying).toBe(true);
    useAppStore.getState().setPlaying(false);
    expect(useAppStore.getState().playback.isPlaying).toBe(false);
  });

  it('setSpeed updates speed without touching isPlaying', () => {
    useAppStore.getState().setPlaying(true);
    useAppStore.getState().setSpeed(2);
    const s = useAppStore.getState();
    expect(s.playback.speed).toBe(2);
    expect(s.playback.isPlaying).toBe(true);
  });
});
