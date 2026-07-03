'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ConditionBadge, TypeBadge } from '@/components/badges';
import { GlassCard } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { cn, daysUntil, formatDate, formatMoney } from '@/lib/utils';

export default function AlertsPage() {
  const [days, setDays] = useState(30);
  const alerts = useQuery({
    queryKey: ['alerts', days],
    queryFn: () => api.warrantyAlerts(days),
  });

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">
            Warranty <span className="neon-text">Watch</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">// coverage expiring soon, most urgent first</p>
        </div>
        <Select className="w-36" value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Next 7 days</option>
          <option value={30}>Next 30 days</option>
          <option value={90}>Next 90 days</option>
          <option value={365}>Next year</option>
        </Select>
      </header>

      {alerts.isPending ? (
        <PageLoader label="Scanning coverage" />
      ) : alerts.isError ? (
        <ErrorState message={(alerts.error as Error).message} />
      ) : alerts.data.length === 0 ? (
        <GlassCard className="border-neon-green/30 p-12 text-center">
          <ShieldCheck size={36} className="mx-auto text-neon-green" />
          <p className="mt-3 font-display text-sm uppercase tracking-widest text-neon-green">
            All shields holding
          </p>
          <p className="mt-2 text-sm text-slate-400">
            No warranties expire in the next {days} days.
          </p>
        </GlassCard>
      ) : (
        <ul className="space-y-3">
          {alerts.data.map((part, i) => {
            const left = daysUntil(part.warranty_expiry) ?? 0;
            const critical = left <= 14;
            return (
              <motion.li
                key={part.id}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link href={`/parts/view?id=${part.id}`}>
                  <GlassCard
                    className={cn(
                      'glass-hover flex flex-wrap items-center gap-3 py-4',
                      critical ? 'border-neon-red/40' : 'border-neon-amber/30',
                    )}
                  >
                    <ShieldAlert
                      size={20}
                      className={cn('shrink-0', critical ? 'text-neon-red' : 'text-neon-amber')}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-100">
                        {part.brand} {part.model}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <TypeBadge type={part.type} />
                        <ConditionBadge condition={part.condition} />
                        <span>in {part.pc_name ?? 'inventory'}</span>
                        <span className="font-mono">{formatMoney(part.purchase_price)}</span>
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          'font-display text-xl font-bold',
                          critical ? 'text-neon-red' : 'text-neon-amber',
                        )}
                      >
                        {left}d
                      </p>
                      <p className="font-mono text-[10px] text-slate-500">
                        {formatDate(part.warranty_expiry)}
                      </p>
                    </div>
                  </GlassCard>
                </Link>
              </motion.li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
