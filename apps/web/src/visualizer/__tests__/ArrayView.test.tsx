import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArrayView } from '../ArrayView';
import type { ArrayObject } from '../../trace/types';

describe('ArrayView component', () => {
  const sampleArray: ArrayObject = {
    kind: 'array',
    elemType: 'int',
    length: 4,
    items: [
      { k: 'prim', t: 'int', v: 10 },
      { k: 'prim', t: 'int', v: 20 },
      { k: 'prim', t: 'int', v: 30 },
      { k: 'prim', t: 'int', v: 40 },
    ],
    clipped: false,
  };

  it('renders all array cells and their values', () => {
    render(<ArrayView id="@1" obj={sampleArray} name="arr" />);

    expect(screen.getByText('arr')).toBeInTheDocument();
    expect(screen.getByText('int[4]')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
  });

  it('renders index markers below cells', () => {
    const markers = [
      { variableName: 'i', cellIndex: 1 },
      { variableName: 'ptr', cellIndex: 1 },
      { variableName: 'right', cellIndex: 3 },
    ];

    render(
      <ArrayView
        id="@1"
        obj={sampleArray}
        name="arr"
        markers={markers}
      />,
    );

    // Marker labels rendered
    expect(screen.getByText('i')).toBeInTheDocument();
    expect(screen.getByText('ptr')).toBeInTheDocument();
    expect(screen.getByText('right')).toBeInTheDocument();
  });

  it('renders clipped notice and indicator when clipped', () => {
    const clippedArray: ArrayObject = {
      ...sampleArray,
      length: 100,
      clipped: true,
    };

    render(<ArrayView id="@1" obj={clippedArray} name="bigArr" />);

    expect(
      screen.getByText('Clipped: showing first 4 of 100'),
    ).toBeInTheDocument();
    expect(screen.getByText('+96')).toBeInTheDocument();
  });

  it('highlights changed cells and shows previous value', () => {
    const changes = [
      {
        index: 2,
        prev: { k: 'prim' as const, t: 'int', v: 25 },
        curr: { k: 'prim' as const, t: 'int', v: 30 },
      },
    ];

    render(
      <ArrayView
        id="@1"
        obj={sampleArray}
        name="arr"
        changes={changes}
      />,
    );

    expect(screen.getByText('(was 25)')).toBeInTheDocument();
  });
});
