import { Component, type ErrorInfo, type ReactNode } from 'react';

export interface VisualizerErrorBoundaryProps {
  fallback?: ReactNode;
  fallbackTitle?: string;
  resetKey?: unknown;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class VisualizerErrorBoundary extends Component<
  VisualizerErrorBoundaryProps,
  State
> {
  constructor(props: VisualizerErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('Visualizer rendering error caught by boundary:', error, errorInfo);
  }

  componentDidUpdate(prevProps: VisualizerErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          data-testid="visualizer-error-boundary-fallback"
          className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-amber-500/20 pb-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">⚠ Notice:</span>
              <span className="text-amber-200">
                {this.props.fallbackTitle ??
                  'Specialized visualizer encountered an issue. Falling back to generic object view.'}
              </span>
            </div>
            {this.state.error && (
              <span className="font-mono text-[10px] text-amber-400/70">
                {this.state.error.name}
              </span>
            )}
          </div>
          {this.props.fallback ? (
            <div className="flex flex-wrap gap-4">{this.props.fallback}</div>
          ) : (
            <p className="text-xs text-gray-400">
              Generic object view fallback active.
            </p>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
