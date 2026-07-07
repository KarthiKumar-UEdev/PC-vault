'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertTriangle, ArrowRight, CheckCircle2, ClipboardCheck, ExternalLink,
  Hourglass, MessageSquare, Monitor, Plus, QrCode, Rocket, Send, ShieldAlert,
  Wrench, XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { BuildStatusChip, ConditionBadge, TypeBadge } from '@/components/badges';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { CardTitle, GlassCard } from '@/components/ui/card';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api';
import type { Build } from '@/lib/types';
import { useRole } from '@/lib/use-role';
import { cn, formatDate, formatDateTime, formatMoney } from '@/lib/utils';

const QUICK_ACTIONS = [
  { href: '/pcs/new', label: 'New PC', icon: Monitor },
  { href: '/planner', label: 'New build', icon: Wrench },
  { href: '/inventory', label: 'Register part', icon: Plus },
  { href: '/labels', label: 'QR labels', icon: QrCode },
];

/* ── one build in the pipeline, with the action its status calls for ───── */

function PipelineCard({
  build,
  managerEnabled,
  canAct,
  onError,
}: {
  build: Build;
  managerEnabled: boolean;
  canAct: boolean;
  onError: (e: Error) => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();

  const detail = useQuery({
    queryKey: ['build', build.id],
    queryFn: () => api.getBuild(build.id),
  });
  // rejected builds carry the manager's feedback — surface it right here
  const comments = useQuery({
    queryKey: ['build-comments', build.id],
    queryFn: () => api.listComments(build.id),
    enabled: build.status === 'rejected',
  });
  const feedback = (comments.data ?? [])
    .filter((c) => c.author_role === 'manager')
    .at(-1);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['builds'] });
    queryClient.invalidateQueries({ queryKey: ['build', build.id] });
  };

  const submit = useMutation({
    mutationFn: () => api.submitBuild(build.id),
    onSuccess: invalidate,
    onError,
  });
  const convert = useMutation({
    mutationFn: () => api.convertBuild(build.id),
    onSuccess: (pc) => {
      queryClient.invalidateQueries();
      router.push(`/pcs/view?id=${pc.id}`);
    },
    onError,
  });

  const items = detail.data?.items ?? [];
  const ownedCount = items.filter((i) => i.part).length;
  const canConvert = ownedCount > 0 && (!managerEnabled || build.status === 'approved');

  return (
    <div className="flex flex-col gap-3 border-b border-line px-4 py-3.5 last:border-b-0 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5">
          <span className="truncate font-medium text-slate-100">{build.name}</span>
          <BuildStatusChip status={build.status} />
        </div>
        <p className="mt-1 font-mono text-[11px] text-slate-500">
          {build.item_count} component{build.item_count === 1 ? '' : 's'}
          {detail.data && <> · {ownedCount} owned · {formatMoney(detail.data.total_cost)}</>}
          {' · '}created {formatDate(build.created_at)}
        </p>
        {build.status === 'rejected' && feedback && (
          <p className="mt-2 flex items-start gap-2 rounded-lg border border-neon-red/30 bg-neon-red/5 px-3 py-2 text-xs text-neon-red">
            <MessageSquare size={13} className="mt-0.5 shrink-0" />
            <span>
              manager: “{feedback.body}”
              <span className="ml-2 font-mono text-[10px] text-slate-500">
                {formatDateTime(feedback.created_at)}
              </span>
            </span>
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canAct && (build.status === 'draft' || build.status === 'rejected') && managerEnabled && (
          <Button
            size="sm"
            disabled={submit.isPending || build.item_count === 0}
            onClick={() => submit.mutate()}
            title={build.item_count === 0 ? 'Add parts in the planner first' : undefined}
          >
            <Send size={13} /> {build.status === 'rejected' ? 'Resubmit' : 'Submit'}
          </Button>
        )}
        {canAct && (build.status === 'approved' || (!managerEnabled && build.status !== 'pending')) && (
          <Button
            variant="solid"
            size="sm"
            disabled={convert.isPending || !canConvert}
            onClick={() => convert.mutate()}
            title={ownedCount === 0 ? 'No owned parts to install' : 'Creates a real PC'}
          >
            <Rocket size={13} /> {convert.isPending ? 'Assembling…' : 'Convert'}
          </Button>
        )}
        {build.status === 'pending' && (
          <span className="flex items-center gap-1.5 font-mono text-[11px] text-neon-amber">
            <Hourglass size={12} /> with manager
          </span>
        )}
        <Link
          href={`/planner?id=${build.id}`}
          className="text-slate-500 transition-colors hover:text-neon-cyan"
          aria-label={`Open ${build.name} in planner`}
        >
          <ExternalLink size={15} />
        </Link>
      </div>
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */

export default function AdminPage() {
  const role = useRole();
  const [actionError, setActionError] = useState('');

  const authStatus = useQuery({ queryKey: ['auth-status'], queryFn: api.authStatus });
  const managerEnabled = authStatus.data?.manager_enabled ?? false;

  const builds = useQuery({ queryKey: ['builds'], queryFn: api.listBuilds });
  const alerts = useQuery({ queryKey: ['alerts', 30], queryFn: () => api.warrantyAlerts(30) });
  const parts = useQuery({ queryKey: ['parts', 'all'], queryFn: () => api.listParts() });

  if (builds.isPending || role === null) return <PageLoader label="Opening ops deck" />;
  if (builds.isError) return <ErrorState message={(builds.error as Error).message} />;

  const isAdmin = role === 'admin';
  const all = builds.data;
  // needs-attention first, then ready, then waiting, then drafts
  const ORDER = { rejected: 0, approved: 1, pending: 2, draft: 3 } as const;
  const pipeline = [...all].sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const count = (s: Build['status']) => all.filter((b) => b.status === s).length;

  const problemParts = (parts.data ?? []).filter(
    (p) => p.condition === 'faulty' || p.condition === 'rma',
  );

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">
            Ops <span className="neon-text">Deck</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">
            {isAdmin ? '// run the pipeline, watch the fleet' : '// admin workspace — read only'}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-wrap gap-2">
            {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href}>
                <Button size="sm" variant="outline">
                  <Icon size={13} /> {label}
                </Button>
              </Link>
            ))}
          </div>
        )}
      </header>

      {/* pipeline stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Needs attention" value={count('rejected')} icon={<XCircle size={18} />} accent="red" />
        <StatCard label="Ready to build" value={count('approved')} icon={<Rocket size={18} />} accent="green" delay={0.05} />
        <StatCard label="With manager" value={count('pending')} icon={<Hourglass size={18} />} accent="amber" delay={0.1} />
        <StatCard label="Drafts" value={count('draft')} icon={<ClipboardCheck size={18} />} accent="violet" delay={0.15} />
      </div>

      {actionError && (
        <p className="mt-6 rounded-xl border border-neon-red/40 bg-neon-red/5 px-4 py-3 text-sm text-neon-red">
          {actionError}
        </p>
      )}

      {/* build pipeline */}
      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <CardTitle>Build pipeline</CardTitle>
          {!managerEnabled && (
            <span className="font-mono text-[11px] text-slate-500">
              no manager account — builds convert without approval
            </span>
          )}
        </div>
        {pipeline.length === 0 ? (
          <div className="glass p-10 text-center text-slate-500">
            <Wrench size={22} className="mx-auto mb-3 text-neon-cyan" />
            <p className="font-display text-sm uppercase tracking-widest">No builds in flight</p>
            <p className="mt-2 text-sm">
              Plan one in the <Link href="/planner" className="text-neon-cyan hover:underline">System Builder</Link>.
            </p>
          </div>
        ) : (
          <GlassCard className="p-0">
            {pipeline.map((build, i) => (
              <motion.div
                key={build.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <PipelineCard
                  build={build}
                  managerEnabled={managerEnabled}
                  canAct={isAdmin}
                  onError={(e) =>
                    setActionError(e instanceof ApiError ? e.message : 'Something went wrong')
                  }
                />
              </motion.div>
            ))}
          </GlassCard>
        )}
      </section>

      {/* fleet health */}
      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert size={13} /> Faulty / RMA parts
            </CardTitle>
            <Link href="/inventory" className="font-mono text-[11px] text-neon-violet hover:text-neon-cyan">
              inventory <ArrowRight size={10} className="inline" />
            </Link>
          </div>
          {problemParts.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No faulty or RMA parts. Fleet is healthy.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {problemParts.map((part) => (
                <li key={part.id} className="flex items-center gap-3 text-sm">
                  <TypeBadge type={part.type} />
                  <Link
                    href={`/parts/view?id=${part.id}`}
                    className="min-w-0 flex-1 truncate text-slate-200 hover:text-neon-cyan"
                  >
                    {part.brand} {part.model}
                  </Link>
                  <span className="hidden truncate font-mono text-[11px] text-slate-500 sm:block">
                    {part.pc_name ?? 'inventory'}
                  </span>
                  <ConditionBadge condition={part.condition} />
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        <GlassCard>
          <div className="mb-4 flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle size={13} /> Warranties expiring (30d)
            </CardTitle>
            <Link href="/alerts" className="font-mono text-[11px] text-neon-violet hover:text-neon-cyan">
              all alerts <ArrowRight size={10} className="inline" />
            </Link>
          </div>
          {(alerts.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Nothing expiring in the next 30 days.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {(alerts.data ?? []).map((part) => (
                <li key={part.id} className="flex items-center gap-3 text-sm">
                  <TypeBadge type={part.type} />
                  <Link
                    href={`/parts/view?id=${part.id}`}
                    className="min-w-0 flex-1 truncate text-slate-200 hover:text-neon-cyan"
                  >
                    {part.brand} {part.model}
                  </Link>
                  <span
                    className={cn(
                      'shrink-0 font-mono text-[11px]',
                      part.warranty_expiry && new Date(part.warranty_expiry) < new Date()
                        ? 'text-neon-red'
                        : 'text-neon-amber',
                    )}
                  >
                    {part.warranty_expiry ? formatDate(part.warranty_expiry) : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </section>

      {/* approvals shortcut */}
      {managerEnabled && (
        <p className="mt-8 text-center font-mono text-[11px] text-slate-600">
          review pipeline lives in{' '}
          <Link href="/approvals" className="text-neon-violet hover:text-neon-cyan">
            <CheckCircle2 size={11} className="inline" /> Approvals
          </Link>
          {' '}— the manager decides there
        </p>
      )}
    </div>
  );
}
