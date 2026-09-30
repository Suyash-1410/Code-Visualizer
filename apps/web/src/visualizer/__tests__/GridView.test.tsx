import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { GridView } from '../GridView';
import type { ArrayObject } from '../../trace/types';

describe('GridView component', () => {
  const outerArray: ArrayObject = {
    kind: 'array',
    elemType: 'int[]',
    length: 2,
    items: [
      { k: 'ref', id: '@2' },
      { k: 'ref', id: '@3' },
    ],
    clipped: false,
  };

  const innerArray1: ArrayObject = {
    kind: 'array',
    elemType: 'int',
    length: 3,
    items: [
      { k: 'prim', t: 'int', v: 10 },
      { k: 'prim', t: 'int', v: 20 },
      { k: 'prim', t: 'int', v: 30 },
    ],
    clipped: false,
  };

  const innerArray2: ArrayObject = {
    kind: 'array',
    elemType: 'int',
    length: 3,
    items: [
      { k: 'prim', t: 'int', v: 40 },
      { k: 'prim', t: 'int', v: 50 },
      { k: 'prim', t: 'int', v: 60 },
    ],
    clipped: false,
  };

  it('renders 2D grid with row/column headers and cell values', () => {
    render(
      <GridView
        id="@1"
        obj={outerArray}
        innerArrays={[innerArray1, innerArray2]}
        name="matrix"
      />,
    );

    expect(screen.getByText('matrix')).toBeInTheDocument();
    expect(screen.getByText('int[2][3]')).toBeInTheDocument();
    expect(screen.getByText('2D Grid')).toBeInTheDocument();

    // Check cells via testid and within queries
    expect(
      within(screen.getByTestId('grid-cell-0-0')).getByText('10'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('grid-cell-0-1')).getByText('20'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('grid-cell-0-2')).getByText('30'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('grid-cell-1-0')).getByText('40'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('grid-cell-1-1')).getByText('50'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId('grid-cell-1-2')).getByText('60'),
    ).toBeInTheDocument();
  });

  it('highlights changed cell in a row and displays previous value', () => {
    const innerChanges = new Map([
      [
        '@2',
        [
          {
            index: 1,
            prev: { k: 'prim' as const, t: 'int', v: 99 },
            curr: { k: 'prim' as const, t: 'int', v: 20 },
          },
        ],
      ],
    ]);

    render(
      <GridView
        id="@1"
        obj={outerArray}
        innerArrays={[innerArray1, innerArray2]}
        name="matrix"
        innerChanges={innerChanges}
      />,
    );

    expect(screen.getByText('(was 99)')).toBeInTheDocument();
  });
});
