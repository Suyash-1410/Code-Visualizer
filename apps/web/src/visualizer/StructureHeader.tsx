import React, { useState } from 'react';
import type { Value } from '../trace/types';
import type { StructureOverride } from '../recognition/types';
import type { ResizeInfo } from './stackQueueDiff';
import { motion, AnimatePresence } from 'framer-motion';
import { ViewAsMenu } from './ViewAsMenu';
import { ValueView } from './ValueView';

export interface StructureHeaderProps {
  id: string;
  kind: 'stack' | 'queue' | 'heap';
  backing?: 'array' | 'node';
  heapType?: 'minHeap' | 'maxHeap' | 'unknown';
  confidence: 'high' | 'medium' | 'low';
  reasons: string[];
  className_?: string;
  variableName?: string;
  objectId?: string;
  nonStructuralFields?: Record<string, Value>;
  badges?: {
    isEmpty?: boolean;
    isFull?: boolean;
    count?: number;
    hasWrapped?: boolean;
    isResized?: boolean;
    resizeInfo?: ResizeInfo | null;
  };
  changedFields?: Set<string>;
  showRawArrayToggle?: boolean;
  showRawArray?: boolean;
  onToggleRawArray?: () => void;
  extraControls?: React.ReactNode;
  onViewOverride?: (id: string, kind: StructureOverride) => void;
}

export const StructureHeader: React.FC<StructureHeaderProps> = ({
  id,
  kind,
  backing = 'array',
  heapType,
  confidence,
  reasons,
  className_,
  variableName,
  objectId,
  nonStructuralFields = {},
  badges = {},
  changedFields = new Set(),
  showRawArrayToggle = false,
  showRawArray = false,
  onToggleRawArray,
  extraControls,
  onViewOverride,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  let kindLabel = kind === 'stack' ? 'Stack' : 'Queue';
  if (kind === 'heap') {
    kindLabel =
      heapType === 'minHeap'
        ? 'Min-heap'
        : heapType === 'maxHeap'
          ? 'Max-heap'
          : 'Heap';
  }
  const backingLabel = backing === 'array' ? 'array-backed' : 'node-backed';

  const confidenceStyles = {
    high: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
    medium: 'border-blue-500/30 bg-blue-500/10 text-blue-400',
    low: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  }[confidence];

  const fieldEntries = Object.entries(nonStructuralFields);

  return (
    <div
      data-testid="structure-header"
      className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5"
    >
      {/* Left: Detection label, confidence pill with hover tooltip, and structure identity */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Detection Label with interactive Reasons popover */}
        <div
          className="relative inline-block"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div
            data-testid="detection-badge"
            className="flex cursor-help items-center gap-1.5 text-xs font-semibold text-gray-200"
          >
            <span>Detected as:</span>
            <span
              className={
                kind === 'stack'
                  ? 'text-indigo-400 font-bold'
                  : kind === 'queue'
                    ? 'text-emerald-400 font-bold'
                    : heapType === 'maxHeap'
                      ? 'text-purple-400 font-bold'
                      : 'text-amber-400 font-bold'
              }
            >
              {kindLabel}
            </span>
            <span className="text-[10px] text-gray-500">({backingLabel})</span>
            <span
              data-testid="confidence-badge"
              className={`rounded-full border px-1.5 py-0.2 text-[10px] font-medium ${confidenceStyles}`}
            >
              {confidence} confidence
            </span>
          </div>

          {/* Hover tooltip for detection reasons */}
          {showTooltip && reasons.length > 0 && (
            <div
              data-testid="reasons-tooltip"
              className="absolute left-0 top-full z-40 mt-1 w-64 rounded-md border border-white/15 bg-zinc-900/95 p-2.5 shadow-xl backdrop-blur-md"
            >
              <div className="mb-1 text-[11px] font-semibold text-gray-200">
                Detection Signals:
              </div>
              <ul className="list-disc space-y-1 pl-4 text-[10px] text-gray-300">
                {reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Name and class info */}
        {(variableName || className_) && (
          <div className="flex items-center gap-1.5 font-mono text-xs">
            {variableName && (
              <span className="font-semibold text-blue-300">{variableName}</span>
            )}
            {className_ && (
              <span className="text-gray-400">
                {variableName ? `(${className_})` : className_}
              </span>
            )}
            {objectId && (
              <span className="rounded bg-white/5 px-1 py-0.2 font-mono text-[10px] text-gray-500">
                {objectId}
              </span>
            )}
          </div>
        )}

        {/* Non-structural fields (e.g. capacity = 8, size = 3) */}
        {fieldEntries.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 rounded bg-white/5 px-2 py-0.5 font-mono text-[11px] text-gray-300">
            {fieldEntries.map(([k, v], idx) => {
              const isFieldChanged = changedFields.has(k);
              return (
                <span
                  key={k}
                  className={`inline-flex items-center gap-1 rounded px-1 transition-colors ${
                    isFieldChanged
                      ? 'bg-amber-950/60 text-amber-300 ring-1 ring-amber-400/60'
                      : ''
                  }`}
                >
                  <span className={isFieldChanged ? 'text-amber-400' : 'text-gray-400'}>
                    {k} =
                  </span>
                  <ValueView value={v} />
                  {idx < fieldEntries.length - 1 && (
                    <span className="text-gray-600">,</span>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: State Badges, Raw Array Toggle, View As Menu */}
      <div className="flex flex-wrap items-center gap-2">
        <AnimatePresence>
          {badges.isEmpty && (
            <motion.span
              key="badge-empty"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              data-testid="empty-badge"
              className="rounded border border-gray-600/40 bg-gray-800/60 px-1.5 py-0.5 text-[10px] font-medium text-gray-300"
            >
              Empty
            </motion.span>
          )}

          {badges.isFull && (
            <motion.span
              key="badge-full"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              data-testid="full-badge"
              className="rounded border border-rose-500/40 bg-rose-950/60 px-1.5 py-0.5 text-[10px] font-medium text-rose-300"
            >
              Full
            </motion.span>
          )}

          {badges.count !== undefined && (
            <motion.span
              key="badge-count"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              data-testid="count-badge"
              className="rounded border border-cyan-500/30 bg-cyan-950/40 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300"
            >
              count = {badges.count}
            </motion.span>
          )}

          {badges.hasWrapped && (
            <motion.span
              key="badge-wrapped"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              data-testid="wrapped-badge"
              className="rounded border border-purple-500/40 bg-purple-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-purple-300"
            >
              Wraps around
            </motion.span>
          )}

          {(badges.resizeInfo || badges.isResized) && (
            <motion.span
              key="badge-resized"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ duration: 0.18 }}
              data-testid="resized-badge"
              className="rounded border border-amber-500/50 bg-amber-950/70 px-2 py-0.5 text-[10px] font-semibold text-amber-300 shadow-sm"
            >
              {badges.resizeInfo
                ? `resized: capacity ${badges.resizeInfo.prevCapacity} → ${badges.resizeInfo.currCapacity}`
                : 'Resized'}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Extra controls (e.g. violation toggle, heap size control) */}
        {extraControls}

        {/* Show raw array toggle for array-backed structures */}
        {showRawArrayToggle && (
          <button
            type="button"
            data-testid="raw-array-toggle"
            onClick={onToggleRawArray}
            className={`rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
              showRawArray
                ? 'border-indigo-400 bg-indigo-950/70 text-indigo-200'
                : 'border-white/10 bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
            }`}
            title="Toggle viewing the underlying array directly"
          >
            {showRawArray ? 'Hide raw array' : 'Show raw array'}
          </button>
        )}

        {/* View as... menu */}
        <ViewAsMenu
          targetId={id}
          currentKind={kind}
          onOverride={onViewOverride}
        />
      </div>
    </div>
  );
};
