import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// ── Monaco Editor ────────────────────────────────────────────────────────────
// Monaco uses ResizeObserver, workers, and dynamic script loading — none of
// which are available in jsdom.  We replace the entire @monaco-editor/react
// module with a minimal stub so component render tests don't crash.
vi.mock('@monaco-editor/react', () => ({
  default: vi.fn(({ value }: { value?: string }) =>
    React.createElement('textarea', {
      'data-testid': 'monaco-editor',
      defaultValue: value ?? '',
    }),
  ),
}));

// ── ResizeObserver ────────────────────────────────────────────────────────────
// react-resizable-panels uses ResizeObserver internally.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// ── matchMedia ────────────────────────────────────────────────────────────────
if (typeof globalThis.matchMedia === 'undefined') {
  Object.defineProperty(globalThis, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
