/**
 * ExamplesDropdown — dropdown allowing users to select and load any Phase 1 example program (PRD Section 13).
 */

import React from 'react';
import { useAppStore } from '../store';
import { EXAMPLES, findExampleById } from '../examples';
import { saveSourceToStorage } from '../utils/storage';

export const ExamplesDropdown: React.FC = () => {
  const setSource = useAppStore((s) => s.setSource);
  const clearTrace = useAppStore((s) => s.clearTrace);
  const runState = useAppStore((s) => s.runState);

  const isRunning = runState === 'running';

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (!id) return;
    const example = findExampleById(id);
    if (!example) return;

    clearTrace();
    setSource(example.code);
    saveSourceToStorage(example.code);
  };

  const categories = ['Arrays', 'Recursion', 'OOP', 'Errors'] as const;

  return (
    <div className="flex items-center gap-1.5">
      <label
        htmlFor="example-select"
        className="text-[11px] font-medium text-gray-400"
      >
        Examples:
      </label>
      <select
        id="example-select"
        disabled={isRunning}
        defaultValue=""
        onChange={handleChange}
        className="rounded border border-white/10 bg-canvas-muted px-2.5 py-1 text-xs font-medium text-gray-200 shadow-sm transition-colors hover:border-white/20 focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        title="Load a Phase 1 example program"
      >
        <option value="" disabled>
          — Select an example —
        </option>
        {categories.map((cat) => (
          <optgroup key={cat} label={cat} className="bg-[#161b22] text-gray-400 font-semibold">
            {EXAMPLES.filter((ex) => ex.category === cat).map((ex) => (
              <option key={ex.id} value={ex.id} className="text-gray-200 font-normal">
                {ex.title}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
};
