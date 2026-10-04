import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VisualizerErrorBoundary } from '../VisualizerErrorBoundary';

const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Simulated SVG visualizer layout crash');
  }
  return <div data-testid="child-content">Normal Visualizer Content</div>;
};

describe('VisualizerErrorBoundary', () => {
  it('renders children when no error occurs', () => {
    render(
      <VisualizerErrorBoundary>
        <ThrowingComponent shouldThrow={false} />
      </VisualizerErrorBoundary>,
    );

    expect(screen.getByTestId('child-content')).toHaveTextContent(
      'Normal Visualizer Content',
    );
  });

  it('catches render errors and renders fallback notice and fallback content', () => {
    // Suppress console.error in test output for simulated crash
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <VisualizerErrorBoundary
        fallback={<div data-testid="fallback-object-view">Generic Object View Fallback</div>}
      >
        <ThrowingComponent shouldThrow={true} />
      </VisualizerErrorBoundary>,
    );

    expect(screen.getByTestId('visualizer-error-boundary-fallback')).toBeVisible();
    expect(screen.getByText(/Specialized visualizer encountered an issue/i)).toBeVisible();
    expect(screen.getByTestId('fallback-object-view')).toHaveTextContent(
      'Generic Object View Fallback',
    );

    spy.mockRestore();
  });

  it('resets error state when resetKey changes', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <VisualizerErrorBoundary
        resetKey={1}
        fallback={<div data-testid="fallback-object-view">Generic Fallback</div>}
      >
        <ThrowingComponent shouldThrow={true} />
      </VisualizerErrorBoundary>,
    );

    expect(screen.getByTestId('visualizer-error-boundary-fallback')).toBeVisible();

    // Rerender with different resetKey and non-throwing child
    rerender(
      <VisualizerErrorBoundary
        resetKey={2}
        fallback={<div data-testid="fallback-object-view">Generic Fallback</div>}
      >
        <ThrowingComponent shouldThrow={false} />
      </VisualizerErrorBoundary>,
    );

    expect(screen.getByTestId('child-content')).toHaveTextContent(
      'Normal Visualizer Content',
    );

    spy.mockRestore();
  });
});
