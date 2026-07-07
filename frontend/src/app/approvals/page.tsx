'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  AlertTriangle, CheckCircle2, ClipboardCheck, ExternalLink, Hourglass,
  MessageSquare, ShieldCheck, XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BuildStatusChip } from '@/components/badges';
import { StatCard } from '@/components/stat-card';
import { Button } from '@/components/ui/button';
import { CardTitle, GlassCard } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Label, Textarea } from '@/components/ui/input';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api';
import { checkCompatibility } from '@/lib/compat';
import type { Build } from '@/lib/types';
import { useRole } from '@/lib/use-role';
import { cn, formatDateTime, formatMoney } from '@/lib/utils';

/* ── one pending build, fully loaded for review ────────────────────────── */

function PendingBuildCard({
  build,
  canDecide,
  onError,
}: {
  build: Build;
  canDecide: boolean;
  onError: (e: Error) => void;
}) {
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [rejectComment, setRejectComment] = useState('');

  const detail = useQuery({
    queryKey: ['build', build.id],
    queryFn: () => api.getBuild(build.id),
  });
  const comments = useQuery({
    queryKey: ['build-comments', build.id],
    queryFn: () => api.listComments(build.id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['builds'] });
    queryClient.invalidateQueries({ queryKey: ['build', build.id] });
    queryClient.invalidateQueries({ queryKey: ['build-comments', build.id] });
  };

  const approve = useMutation({
    mutationFn: () => api.approveBuild(build.id),
    onSuccess: invalidate,
    onError,
  });
  const reject = useMutation({
    mutationFn: () => api.rejectBuild(build.id, rejectComment.trim() || undefined),
    onSuccess: () => {
      setRejecting(false);
      setRejectComment('');
      invalidate();
    },
    onError,
  });

  const items = detail.data?.items ?? [];
  const report = useMemo(() => checkCompatibility(items), [items]);
  const errors = report.issues.filter((i) => i.severity === 'error');
  const ownedCount = items.filter((i) => i.part).length;
  const buyCount = items.length - ownedCount;

  return (
    <GlassCard className="glass-hover">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="truncate font-display text-lg font-bold text-slate-100">
              {build.name}
            </h3>
            <BuildStatusChip status={build.status} />
          </div>
          {detail.data?.notes && (
            <p className="mt-1 text-sm text-slate-400">{detail.data.notes}</p>
          )}
          <p className="mt-1 font-mono text-[11px] text-slate-500">
            submitted {formatDateTime(build.created_at)} · {build.item_count} component
            {build.item_count === 1 ? '' : 's'}
          </p>
        </div>
        <Link
          href={`/planner?id=${build.id}`}
          className="flex shrink-0 items-center gap-1.5 font-mono text-xs text-neon-violet transition-colors hover:text-neon-cyan"
        >
          full build sheet <ExternalLink size={12} />
        </Link>
      </div>

      {detail.isPending ? (
        <p className="mt-4 font-mono text-xs text-slate-500">loading build…</p>
      ) : detail.data ? (
        <>
          {/* component summary */}
          <ul className="mt-4 space-y-1.5">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    item.part ? 'bg-neon-green' : 'bg-neon-amber',
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-slate-300">
                  {item.part ? `${item.part.brand} ${item.part.model}` : item.external_name}
                </span>
                <span
                  className={cn(
                    'shrink-0 font-mono text-[10px] uppercase',
                    item.part ? 'text-neon-green' : 'text-neon-amber',
                  )}
                >
                  {item.part ? 'owned' : 'to buy'}
                </span>
                <span className="shrink-0 font-mono text-xs text-neon-cyan">
                  {formatMoney(item.part ? item.part.purchase_price : item.external_price)}
                </span>
              </li>
            ))}
          </ul>

          {/* verdict strip: compat + cost + discussion */}
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line pt-3">
            <span
              className={cn(
                'flex items-center gap-1.5 text-xs',
                errors.length > 0
                  ? 'text-neon-red'
                  : report.issues.length > 0
                    ? 'text-neon-amber'
                    : 'text-neon-green',
              )}
            >
              {errors.length > 0 ? <AlertTriangle size={13} /> : <ShieldCheck size={13} />}
              {errors.length > 0
                ? `${errors.length} compatibility issue${errors.length > 1 ? 's' : ''}`
                : report.issues.length > 0
                  ? `${report.issues.length} note${report.issues.length > 1 ? 's' : ''}`
                  : 'compatible'}
            </span>
            <span className="font-mono text-xs text-slate-400">
              <span className="text-neon-green">{ownedCount} owned</span>
              {' · '}
              <span className="text-neon-amber">{buyCount} to buy</span>
            </span>
            <span className="flex items-center gap-1.5 font-mono text-xs text-slate-400">
              <MessageSquare size={12} /> {comments.data?.length ?? 0}
            </span>
            <span className="ml-auto font-display text-xl font-bold text-neon-cyan">
              {formatMoney(detail.data.total_cost)}
            </span>
          </div>

          {errors.length > 0 && (
            <ul className="mt-2 space-y-1">
              {errors.map((issue) => (
                <li key={issue.message} className="flex items-start gap-2 text-xs text-neon-red">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  {issue.message}
                </li>
              ))}
            </ul>
          )}

          {canDecide ? (
            <div className="mt-4 flex gap-3">
              <Button
                variant="solid"
                className="flex-1"
                disabled={approve.isPending}
                onClick={() => approve.mutate()}
              >
                <CheckCircle2 size={15} /> Approve
              </Button>
              <Button variant="danger" className="flex-1" onClick={() => setRejecting(true)}>
                <XCircle size={15} /> Reject
              </Button>
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-neon-amber/40 bg-neon-amber/5 px-3 py-2 text-center font-mono text-xs text-neon-amber">
              waiting for the manager&apos;s decision
            </p>
          )}
        </>
      ) : null}

      {/* reject dialog */}
      <Dialog open={rejecting} onClose={() => setRejecting(false)} title={`Reject "${build.name}"`}>
        <div className="space-y-3">
          <Label>Feedback for the admin (optional)</Label>
          <Textarea
            autoFocus
            placeholder="What should change before you approve it?"
            value={rejectComment}
            onChange={(e) => setRejectComment(e.target.value)}
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRejecting(false)}>
            Cancel
          </Button>
          <Button variant="danger" disabled={reject.isPending} onClick={() => reject.mutate()}>
            <XCircle size={15} /> Reject build
          </Button>
        </div>
      </Dialog>
    </GlassCard>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */

export default function ApprovalsPage() {
  const role = useRole();
  const [actionError, setActionError] = useState('');

  const builds = useQuery({ queryKey: ['builds'], queryFn: api.listBuilds });

  if (builds.isPending || role === null) return <PageLoader label="Opening review deck" />;
  if (builds.isError) return <ErrorState message={(builds.error as Error).message} />;

  const all = builds.data;
  const pending = all.filter((b) => b.status === 'pending');
  const decided = all.filter((b) => b.status === 'approved' || b.status === 'rejected');
  const drafts = all.filter((b) => b.status === 'draft');
  const isManager = role === 'manager';

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-slate-100">
          Approval <span className="neon-text">Deck</span>
        </h1>
        <p className="mt-1 font-mono text-xs text-slate-500">
          {isManager
            ? '// builds waiting for your sign-off'
            : '// review pipeline — the manager signs off here'}
        </p>
      </header>

      {/* pipeline stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Pending review" value={pending.length} icon={<Hourglass size={18} />} accent="amber" />
        <StatCard
          label="Approved" value={all.filter((b) => b.status === 'approved').length}
          icon={<CheckCircle2 size={18} />} accent="green" delay={0.05}
        />
        <StatCard
          label="Rejected" value={all.filter((b) => b.status === 'rejected').length}
          icon={<XCircle size={18} />} accent="red" delay={0.1}
        />
        <StatCard label="Drafts" value={drafts.length} icon={<ClipboardCheck size={18} />} accent="violet" delay={0.15} />
      </div>

      {actionError && (
        <p className="mt-6 rounded-xl border border-neon-red/40 bg-neon-red/5 px-4 py-3 text-sm text-neon-red">
          {actionError}
        </p>
      )}

      {/* pending queue */}
      <section className="mt-8">
        <CardTitle className="mb-4">Waiting for review</CardTitle>
        {pending.length === 0 ? (
          <div className="glass p-10 text-center text-slate-500">
            <ShieldCheck size={22} className="mx-auto mb-3 text-neon-green" />
            <p className="font-display text-sm uppercase tracking-widest">Queue clear</p>
            <p className="mt-2 text-sm">
              {isManager
                ? 'Nothing needs your sign-off right now.'
                : 'Submit a build from the planner to start a review.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {pending.map((build, i) => (
              <motion.div
                key={build.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
              >
                <PendingBuildCard
                  build={build}
                  canDecide={isManager}
                  onError={(e) =>
                    setActionError(e instanceof ApiError ? e.message : 'Something went wrong')
                  }
                />
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* decision history */}
      {decided.length > 0 && (
        <section className="mt-10">
          <CardTitle className="mb-4">Decisions</CardTitle>
          <GlassCard className="p-0">
            <ul>
              {decided.map((build) => (
                <li
                  key={build.id}
                  className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
                >
                  {build.status === 'approved' ? (
                    <CheckCircle2 size={16} className="shrink-0 text-neon-green" />
                  ) : (
                    <XCircle size={16} className="shrink-0 text-neon-red" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{build.name}</span>
                  <span className="hidden font-mono text-[11px] text-slate-500 sm:block">
                    {build.item_count} component{build.item_count === 1 ? '' : 's'}
                  </span>
                  <BuildStatusChip status={build.status} />
                  <Link
                    href={`/planner?id=${build.id}`}
                    className="text-slate-500 transition-colors hover:text-neon-cyan"
                    aria-label={`Open ${build.name} in planner`}
                  >
                    <ExternalLink size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          </GlassCard>
        </section>
      )}
    </div>
  );
}
