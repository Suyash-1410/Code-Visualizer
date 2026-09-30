/**
 * FixtureLoader — dev-only component.
 *
 * Renders a dropdown that lets you load any .json from tests/fixtures/traces
 * directly into the store (bypassing the API).  Hidden in production builds
 * via import.meta.env.DEV guard.
 *
 * Also loads the Stage 4 golden fixtures (BubbleSort, Factorial, etc.) that
 * have been copied into tests/fixtures/traces/ alongside the Stage 1 fixtures.
 */

import React, { useState } from 'react';
import { validateTrace } from '../../trace';
import { useAppStore } from '../../store';

// Vite's `import.meta.glob` loads all JSON files under the fixtures directory
// at build time (lazily).  The path is relative to this file.
const fixtureModules = import.meta.glob(
  '../../../../../tests/fixtures/traces/*.json',
  { eager: false },
);

function fixtureNames(): string[] {
  return Object.keys(fixtureModules).map((key) =>
    key.replace(/^.*\//, '').replace(/\.json$/, ''),
  );
}

const FixtureLoaderInner: React.FC = () => {
  const { setTrace, setError, startRun } = useAppStore();
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);

  const names = fixtureNames();

  async function load() {
    if (!selected) return;

    const key = Object.keys(fixtureModules).find((k) =>
      k.endsWith(`/${selected}.json`),
    );
    if (!key) {
      setError(`Fixture "${selected}" not found`);
      return;
    }

    setLoading(true);
    startRun();

    try {
      const mod = (await fixtureModules[key]()) as { default: unknown };
      const result = validateTrace(mod.default);
      if (result.success) {
        setTrace(result.data);
      } else {
        setError(`Fixture validation failed: ${result.error}`);
      }
    } catch (e) {
      setError(
        `Failed to load fixture: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2 rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
      <span className="shrink-0 font-semibold uppercase tracking-wide">
        DEV
      </span>
      <select
        className="max-w-[180px] truncate bg-transparent text-amber-200 focus:outline-none"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">— load fixture —</option>
        {names.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button
        onClick={() => void load()}
        disabled={!selected || loading}
        className="rounded bg-amber-500/20 px-2 py-0.5 font-medium text-amber-100 hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading ? 'Loading…' : 'Load'}
      </button>
    </div>
  );
};

/**
 * Exported component — renders nothing in production builds.
 */
export const FixtureLoader: React.FC = () => {
  if (!import.meta.env.DEV) return null;
  return <FixtureLoaderInner />;
};
