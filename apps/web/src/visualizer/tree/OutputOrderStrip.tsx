import React from 'react';
import type { OutputToken } from './outputOrder';
import { Terminal, ExternalLink } from 'lucide-react';

export interface OutputOrderStripProps {
  tokens: OutputToken[];
  hoveredHeapId?: string | null;
  onHoverRef?: (id: string | null) => void;
  onClickRef?: (id: string | null) => void;
}

export const OutputOrderStrip: React.FC<OutputOrderStripProps> = ({
  tokens,
  hoveredHeapId,
  onHoverRef,
  onClickRef,
}) => {
  if (tokens.length === 0) return null;

  return (
    <div
      data-testid="output-order-strip"
      className="flex items-center gap-2 px-3 py-1.5 bg-slate-950/90 border-t border-slate-800 text-xs overflow-x-auto select-none"
    >
      <div className="flex items-center gap-1.5 shrink-0 text-slate-400 font-medium text-[11px]">
        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
        <span>Output order:</span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {tokens.map((token) => {
          const isLinked = token.nodeId !== null;
          const isHovered = isLinked && hoveredHeapId === token.nodeId;

          if (isLinked) {
            return (
              <button
                key={token.id}
                type="button"
                data-testid={`output-token-${token.text}`}
                onClick={() => onClickRef?.(token.nodeId!)}
                onMouseEnter={() => onHoverRef?.(token.nodeId!)}
                onMouseLeave={() => onHoverRef?.(null)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[11px] font-semibold border transition-all ${
                  isHovered
                    ? 'bg-sky-900/70 border-sky-400 text-sky-200 shadow-sm shadow-sky-500/20'
                    : 'bg-emerald-950/50 border-emerald-600/40 text-emerald-300 hover:bg-emerald-900/60 hover:border-emerald-500 hover:text-emerald-100'
                }`}
                title={`Printed value linked to node ${token.nodeId} (click to focus)`}
              >
                <span>{token.text}</span>
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </button>
            );
          }

          return (
            <span
              key={token.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded font-mono text-[11px] text-slate-400 bg-slate-900 border border-slate-800"
              title="Unlinked output text"
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
