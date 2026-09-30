import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CallStackPanel } from '../CallStackPanel';
import type { Step, Trace } from '../../trace/types';

describe('CallStackPanel component', () => {
  const stepNormal: Step = {
    i: 3,
    event: 'line',
    line: 10,
    stack: [
      {
        frameId: 1,
        method: 'Factorial.main',
        signature: 'void main(String[])',
        line: 3,
        locals: [{ name: 'args', type: 'String[]', value: { k: 'ref', id: '@1' } }],
      },
      {
        frameId: 2,
        method: 'Factorial.fact',
        signature: 'int fact(int)',
        line: 10,
        locals: [{ name: 'n', type: 'int', value: { k: 'prim', t: 'int', v: 3 } }],
      },
    ],
    heap: {},
    statics: [],
    returnValue: null,
    stdoutLen: 0,
    clipped: false,
  };

  const traceMock: Trace = {
    schemaVersion: 1,
    status: 'ok',
    truncation: null,
    compileErrors: [],
    runtimeError: null,
    source: '',
    stdout: '',
    steps: [stepNormal],
    stats: { stepCount: 10, maxDepth: 5, durationMs: 50 },
  };

  it('renders stack frames with active top frame and depth indicators', () => {
    render(<CallStackPanel step={stepNormal} trace={traceMock} />);

    expect(screen.getByText('depth 2')).toBeInTheDocument();
    expect(screen.getByText('max 5')).toBeInTheDocument();

    // Top/active frame: fact(n = 3)
    expect(screen.getByText('fact(n = 3)')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Caller frame: main(args = @1)
    expect(screen.getByText('main(args = @1)')).toBeInTheDocument();
  });

  it('displays return value on returning frame and caller receiving badge', () => {
    const stepReturn: Step = {
      ...stepNormal,
      event: 'return',
      returnValue: { k: 'prim', t: 'int', v: 6 },
    };

    render(<CallStackPanel step={stepReturn} trace={traceMock} />);

    // Returning frame displays "returns 6" and caller displays "← receiving 6"
    expect(screen.getByText('returns')).toBeInTheDocument();
    expect(screen.getAllByText('6')).toHaveLength(2);

    // Caller displays "← receiving 6"
    expect(screen.getByText('← receiving')).toBeInTheDocument();
  });

  it('shows depth-limit explanation when recursion cap is hit', () => {
    const traceDepthLimit: Trace = {
      ...traceMock,
      status: 'truncated',
      truncation: { reason: 'depth_limit', atStep: 200 },
    };

    render(<CallStackPanel step={stepNormal} trace={traceDepthLimit} />);

    expect(screen.getByTestId('depth-limit-alert')).toBeInTheDocument();
    expect(
      screen.getByText(/Recursion went deeper than 200 calls, likely infinite recursion/i),
    ).toBeInTheDocument();
  });

  it('invokes onSelectFrame when a frame card is clicked', () => {
    const onSelectFrame = vi.fn();
    render(
      <CallStackPanel
        step={stepNormal}
        trace={traceMock}
        onSelectFrame={onSelectFrame}
      />,
    );

    fireEvent.click(screen.getByTestId('stack-frame-1'));
    expect(onSelectFrame).toHaveBeenCalledWith(1);
  });
});
