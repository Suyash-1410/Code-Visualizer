import React from 'react';

interface ReferenceChipProps {
  id: string;
  type?: string;
  summary?: string;
  onHover?: (id: string | null) => void;
  onClick?: (id: string) => void;
  className?: string;
}

export const ReferenceChip: React.FC<ReferenceChipProps> = ({
  id,
  type,
  summary,
  onHover,
  onClick,
  className = '',
}) => {
  // If summary is provided (e.g. "Node(3)"), use it directly; otherwise format as "Node@3"
  const label = summary ?? (type ? (id.startsWith('@') ? `${type}${id}` : `${type}@${id}`) : id);

  return (
    <button
      type="button"
      onMouseEnter={() => onHover?.(id)}
      onMouseLeave={() => onHover?.(null)}
      onClick={() => onClick?.(id)}
      className={`inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-950/40 px-2 py-0.5 text-[11px] font-mono font-medium text-violet-300 transition-colors hover:border-violet-400 hover:bg-violet-900/50 hover:text-violet-100 ${className}`}
      title={`Reference to ${type ?? 'object'} ${id} (click to focus in diagram)`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
      <span>{label}</span>
    </button>
  );
};
