import React from 'react';

export const App: React.FC = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-canvas p-6 text-center">
      <div className="max-w-xl rounded-xl border border-gray-800 bg-canvas-subtle p-8 shadow-2xl">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-400">
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          Stage 0: Scaffold Initialized
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          JavaScope
        </h1>
        <p className="mt-3 text-sm text-gray-400">
          Interactive Java DSA and Recursion Visualizer. Runtime execution stepped cleanly with data-structure-aware layouts.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-gray-500">
          <span className="rounded bg-canvas-muted px-2 py-1">React 18</span>
          <span className="rounded bg-canvas-muted px-2 py-1">TypeScript</span>
          <span className="rounded bg-canvas-muted px-2 py-1">Monaco</span>
          <span className="rounded bg-canvas-muted px-2 py-1">Zustand</span>
          <span className="rounded bg-canvas-muted px-2 py-1">Framer Motion</span>
          <span className="rounded bg-canvas-muted px-2 py-1">Tailwind CSS</span>
        </div>
      </div>
    </div>
  );
};

export default App;
