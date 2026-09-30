/**
 * Smoke test: App renders without crashing.
 * Full component tests come in later stages when visualization panels are implemented.
 */

import { describe, it } from 'vitest';
import { render } from '@testing-library/react';
import App from './App';

describe('App', () => {
  it('renders without throwing', () => {
    // Monaco and react-resizable-panels both work in jsdom (no canvas required).
    render(<App />);
  });
});
