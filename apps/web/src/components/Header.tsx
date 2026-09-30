/**
 * Header — product name, status badge, and dev-mode fixture loader.
 */

import React from 'react';
import { FixtureLoader } from './dev/FixtureLoader';

export const Header: React.FC = () => (
  <header className="flex h-12 shrink-0 items-center gap-3 border-b border-white/8 bg-canvas-subtle px-4">
    {/* Logo / product name */}
    <div className="flex items-center gap-2">
      <span className="text-base font-bold tracking-tight text-white">
        Java<span className="text-blue-400">Scope</span>
      </span>
      <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-blue-400">
        beta
      </span>
    </div>

    {/* Spacer */}
    <div className="flex-1" />

    {/* Dev fixture loader — hidden in prod */}
    <FixtureLoader />
  </header>
);
