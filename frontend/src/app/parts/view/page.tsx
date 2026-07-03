'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, ArrowRightLeft, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { ConditionBadge, TypeBadge } from '@/components/badges';
import { PartFormDialog } from '@/components/part-form-dialog';
import { TransferDialog } from '@/components/transfer-dialog';
import { WarrantyRing } from '@/components/warranty-ring';
import { Button } from '@/components/ui/button';
import { CardTitle, GlassCard } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatAge, formatDate, formatDateTime, formatMoney } from '@/lib/utils';

function PartDetailContent() {
  const params = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.get('id') ?? '';
  const [editing, setEditing] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const part = useQuery({
    queryKey: ['part', id],
    queryFn: () => api.getPart(id),
    enabled: id.length > 0,
  });
  const history = useQuery({
    queryKey: ['part-history', id],
    queryFn: () => api.partHistory(id),
    enabled: id.length > 0,
  });

  const del = useMutation({
    mutationFn: () => api.deletePart(id),
    onSuccess: () => {
      queryClient.invalidateQueries();
      router.push('/inventory');
    },
  });

  if (!id) return <ErrorState message="No part id supplied." />;
  if (part.isPending) return <PageLoader label="Retrieving dossier" />;
  if (part.isError) return <ErrorState message={(part.error as Error).message} />;

  const p = part.data;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <button onClick={() => router.back()} className="text-slate-500 transition-colors hover:text-neon-cyan" aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <TypeBadge type={p.type} />
        <h1 className="font-display text-xl font-bold text-slate-100 sm:text-2xl">
          {p.brand} {p.model}
        </h1>
        <ConditionBadge condition={p.condition} />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setTransferring(true)}>
            <ArrowRightLeft size={14} /> Transfer
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil size={14} />
          </Button>
          <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 size={14} />
          </Button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* specs */}
        <GlassCard className="lg:col-span-2">
          <CardTitle className="mb-4">Specifications</CardTitle>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-slate-500">Location</dt>
              <dd className="mt-0.5">
                {p.pc_id ? (
                  <Link href={`/pcs/view?id=${p.pc_id}`} className="text-neon-cyan hover:underline">
                    {p.pc_name}
                  </Link>
                ) : (
                  <span className="text-neon-violet">Inventory</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-slate-500">Age</dt>
              <dd className="mt-0.5 text-slate-200">{formatAge(p.purchase_date)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-slate-500">Purchased</dt>
              <dd className="mt-0.5 text-slate-200">{formatDate(p.purchase_date)}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-widest text-slate-500">Price</dt>
              <dd className="mt-0.5 font-mono text-neon-cyan">{formatMoney(p.purchase_price)}</dd>
            </div>
            {p.serial_number && (
              <div className="col-span-2">
                <dt className="text-[10px] uppercase tracking-widest text-slate-500">Serial number</dt>
                <dd className="mt-0.5 break-all font-mono text-neon-violet">{p.serial_number}</dd>
              </div>
            )}
          </dl>
          {p.specs && Object.keys(p.specs).length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <CardTitle className="mb-3">Technical readout</CardTitle>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                {Object.entries(p.specs).map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-panel-2/60 px-3 py-2">
                    <dt className="font-mono text-[10px] uppercase text-slate-500">{key}</dt>
                    <dd className="mt-0.5 text-sm text-slate-200">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </GlassCard>

        {/* warranty ring */}
        <GlassCard className="flex flex-col items-center justify-center gap-2">
          <CardTitle>Warranty</CardTitle>
          <WarrantyRing expiry={p.warranty_expiry} />
          <p className="font-mono text-xs text-slate-500">
            {p.warranty_expiry ? `until ${formatDate(p.warranty_expiry)}` : 'no warranty on file'}
          </p>
        </GlassCard>
      </div>

      {/* transfer history timeline */}
      <GlassCard className="mt-6">
        <CardTitle className="mb-4">Movement log</CardTitle>
        {history.isPending ? (
          <PageLoader label="Reading log" />
        ) : (history.data?.length ?? 0) === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No transfers recorded.</p>
        ) : (
          <ol className="relative ml-3 space-y-5 border-l border-line pl-6">
            {history.data!.map((log) => (
              <li key={log.id} className="relative">
                <span className="absolute -left-[31px] top-1 h-2.5 w-2.5 rounded-full bg-neon-cyan shadow-glow-cyan" />
                <p className="text-sm text-slate-200">
                  <span className="text-slate-400">{log.from_pc_name ?? 'Inventory'}</span>
                  <ArrowRight size={12} className="mx-1.5 inline text-neon-violet" />
                  <span className="font-semibold text-neon-cyan">{log.to_pc_name ?? 'Inventory'}</span>
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-slate-500">{formatDateTime(log.moved_at)}</p>
              </li>
            ))}
          </ol>
        )}
      </GlassCard>

      <PartFormDialog open={editing} onClose={() => setEditing(false)} part={p} />
      <TransferDialog part={p} open={transferring} onClose={() => setTransferring(false)} />
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Scrap part">
        <p className="text-sm text-slate-300">
          Permanently delete <span className="font-bold text-neon-red">{p.brand} {p.model}</span> and
          its transfer history?
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" disabled={del.isPending} onClick={() => del.mutate()}>
            {del.isPending ? 'Deleting…' : 'Delete part'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export default function PartDetailPage() {
  return (
    <Suspense fallback={<PageLoader label="Retrieving dossier" />}>
      <PartDetailContent />
    </Suspense>
  );
}
