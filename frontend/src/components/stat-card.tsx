'use client';

import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { GlassCard } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** rAF count-up from 0 to `value` over ~0.9s with ease-out. */
export function useCountUp(value: number, durationMs = 900): number {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value, durationMs]);

  return display;
}

export function StatCard({
  label,
  value,
  icon,
  accent = 'cyan',
  format = (n) => Math.round(n).toLocaleString(),
  delay = 0,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: 'cyan' | 'violet' | 'green' | 'amber' | 'red';
  format?: (n: number) => string;
  delay?: number;
}) {
  const display = useCountUp(value);
  const accents = {
    cyan: 'text-neon-cyan border-neon-cyan/30',
    violet: 'text-neon-violet border-neon-violet/30',
    green: 'text-neon-green border-neon-green/30',
    amber: 'text-neon-amber border-neon-amber/30',
    red: 'text-neon-red border-neon-red/30',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
    >
      <GlassCard className="glass-hover relative overflow-hidden">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
              {label}
            </p>
            <p className={cn('mt-2 font-display text-3xl font-bold tabular-nums', accents[accent].split(' ')[0])}>
              {format(display)}
            </p>
          </div>
          <span className={cn('grid h-10 w-10 place-items-center rounded-lg border bg-panel-2/60', accents[accent])}>
            {icon}
          </span>
        </div>
      </GlassCard>
    </motion.div>
  );
}
