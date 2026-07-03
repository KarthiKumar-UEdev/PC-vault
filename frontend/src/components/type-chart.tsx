'use client';

import { motion } from 'framer-motion';
import type { Part } from '@/lib/types';
import { PART_TYPE_LABELS, PART_TYPES } from '@/lib/types';

const BAR_COLORS = [
  '#22d3ee', '#a78bfa', '#e879f9', '#34d399', '#fbbf24',
  '#fb7185', '#60a5fa', '#f472b6', '#4ade80', '#facc15', '#94a3b8',
];

/** Neon horizontal bar chart of part counts per type. */
export function TypeChart({ parts }: { parts: Part[] }) {
  const counts = PART_TYPES.map((type) => ({
    type,
    count: parts.filter((p) => p.type === type).length,
  })).filter((row) => row.count > 0);

  const max = Math.max(1, ...counts.map((r) => r.count));

  if (counts.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-500">No parts registered yet.</p>;
  }

  return (
    <div className="space-y-2.5">
      {counts.map((row, i) => (
        <div key={row.type} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-right font-mono text-[11px] uppercase text-slate-400">
            {PART_TYPE_LABELS[row.type]}
          </span>
          <div className="h-4 flex-1 overflow-hidden rounded-full bg-panel-2/70">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${BAR_COLORS[i % BAR_COLORS.length]}44, ${BAR_COLORS[i % BAR_COLORS.length]})`,
                boxShadow: `0 0 10px ${BAR_COLORS[i % BAR_COLORS.length]}66`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${(row.count / max) * 100}%` }}
              transition={{ duration: 0.7, delay: i * 0.06, ease: 'easeOut' }}
            />
          </div>
          <span className="w-6 shrink-0 font-mono text-xs text-slate-300">{row.count}</span>
        </div>
      ))}
    </div>
  );
}
