'use client';

import { motion } from 'framer-motion';
import { Cpu } from 'lucide-react';
import Link from 'next/link';
import { StatusBadge } from '@/components/badges';
import { GlassCard } from '@/components/ui/card';
import type { PC } from '@/lib/types';
import { cn, formatDate, formatMoney } from '@/lib/utils';

export function PCCard({ pc, index = 0 }: { pc: PC; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35 }}
    >
      <Link href={`/pcs/view?id=${pc.id}`}>
        <GlassCard
          className={cn(
            'glass-hover group relative cursor-pointer overflow-hidden',
            pc.status === 'active' && 'border-neon-green/20',
          )}
        >
          {pc.status === 'active' && (
            <span className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-neon-green/10 blur-2xl" />
          )}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate font-display text-lg font-bold text-slate-100 transition-colors group-hover:text-neon-cyan">
                {pc.name}
              </h3>
              <p className="mt-1 line-clamp-2 min-h-10 text-sm text-slate-400">
                {pc.description || 'No description.'}
              </p>
            </div>
            <StatusBadge status={pc.status} />
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
            <span className="flex items-center gap-1.5 text-slate-400">
              <Cpu size={13} className="text-neon-violet" />
              {pc.part_count} parts
            </span>
            <span className="font-mono text-neon-cyan">{formatMoney(pc.total_value)}</span>
            <span className="text-slate-500">{formatDate(pc.build_date)}</span>
          </div>
        </GlassCard>
      </Link>
    </motion.div>
  );
}
