import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App placeholder', () => {
  it('renders JavaScope placeholder heading', () => {
    render(<App />);
    expect(screen.getByText('JavaScope')).toBeInTheDocument();
    expect(screen.getByText(/Interactive Java DSA and Recursion Visualizer/i)).toBeInTheDocument();
  });
});
