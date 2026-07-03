'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Cpu,
  DollarSign,
  Monitor,
  ShieldAlert,
  Timer,
} from 'lucide-react';
import Link from 'next/link';
import { StatCard } from '@/components/stat-card';
import { TypeChart } from '@/components/type-chart';
import { CardTitle, GlassCard } from '@/components/ui/card';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

export default function DashboardPage() {
  const stats = useQuery({ queryKey: ['stats'], queryFn: api.stats });
  const alerts = useQuery({ queryKey: ['alerts', 30], queryFn: () => api.warrantyAlerts(30) });
  const transfers = useQuery({ queryKey: ['transfers'], queryFn: () => api.recentTransfers(8) });
  const parts = useQuery({ queryKey: ['parts', 'all'], queryFn: () => api.listParts() });

  if (stats.isPending) return <PageLoader label="Booting vault" />;
  if (stats.isError) return <ErrorState message={(stats.error as Error).message} />;

  const s = stats.data;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-wide text-slate-100">
          Command <span className="neon-text">Center</span>
        </h1>
        <p className="mt-1 font-mono text-xs text-slate-500">
          // fleet telemetry · {new Date().toLocaleDateString()}
        </p>
      </header>

      {/* warranty banner */}
      {(alerts.data?.length ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Link href="/alerts">
            <div className="glass mb-6 flex items-center gap-3 border-neon-amber/40 bg-neon-amber/5 px-4 py-3 transition-shadow hover:shadow-[0_0_20px_rgba(251,191,36,0.15)]">
              <AlertTriangle size={18} className="shrink-0 text-neon-amber" />
              <p className="text-sm text-neon-amber">
                <span className="font-bold">{alerts.data!.length} warranties</span> expiring
                within 30 days
              </p>
              <ArrowRight size={16} className="ml-auto text-neon-amber/60" />
            </div>
          </Link>
        </motion.div>
      )}

      {/* stat grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total PCs" value={s.total_pcs} icon={<Monitor size={18} />} accent="cyan" />
        <StatCard label="Active" value={s.active_pcs} icon={<Timer size={18} />} accent="green" delay={0.05} />
        <StatCard label="Parts" value={s.total_parts} icon={<Cpu size={18} />} accent="violet" delay={0.1} />
        <StatCard label="In inventory" value={s.inventory_count} icon={<Boxes size={18} />} accent="cyan" delay={0.15} />
        <StatCard
          label="Fleet value" value={parseFloat(s.total_value)} icon={<DollarSign size={18} />}
          accent="green" delay={0.2}
          format={(n) => `₹${Math.round(n).toLocaleString('en-IN')}`}
        />
        <StatCard label="Faulty / RMA" value={s.faulty_parts} icon={<ShieldAlert size={18} />} accent="red" delay={0.25} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* part type distribution */}
        <GlassCard>
          <CardTitle className="mb-4">Part distribution</CardTitle>
          {parts.isPending ? (
            <PageLoader label="Scanning" />
          ) : (
            <TypeChart parts={parts.data ?? []} />
          )}
        </GlassCard>

        {/* recent transfers */}
        <GlassCard>
          <CardTitle className="mb-4">Recent transfers</CardTitle>
          {transfers.isPending ? (
            <PageLoader label="Syncing" />
          ) : (transfers.data?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No movement logged yet.</p>
          ) : (
            <ul className="space-y-3">
              {transfers.data!.map((log) => (
                <li key={log.id} className="flex items-center gap-3 border-b border-line pb-3 text-sm last:border-0 last:pb-0">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neon-cyan shadow-glow-cyan" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-slate-200">
                      {log.part_label ?? 'Part'}
                    </p>
                    <p className="font-mono text-[11px] text-slate-500">
                      {log.from_pc_name ?? 'inventory'}
                      <ArrowRight size={10} className="mx-1 inline text-neon-violet" />
                      {log.to_pc_name ?? 'inventory'}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-slate-600">
                    {formatDateTime(log.moved_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
