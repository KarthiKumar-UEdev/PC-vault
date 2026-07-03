'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Download, Pencil, QrCode, Trash2, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { ConditionBadge, StatusBadge, TypeBadge } from '@/components/badges';
import { NetworkPanel } from '@/components/network-panel';
import { Button } from '@/components/ui/button';
import { CardTitle, GlassCard } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useIsAdmin } from '@/lib/use-role';
import { useViewerStore } from '@/lib/store';
import { PART_TYPE_LABELS } from '@/lib/types';
import { formatAge, formatDate, formatMoney } from '@/lib/utils';

const PCViewer = dynamic(
  () => import('@/components/three/pc-viewer').then((m) => m.PCViewer),
  {
    ssr: false,
    loading: () => (
      <div className="grid h-full place-items-center">
        <p className="animate-pulse font-mono text-xs uppercase tracking-[0.3em] text-neon-cyan">
          rendering hologram…
        </p>
      </div>
    ),
  },
);

function PartSidePanel({ pcId }: { pcId: string }) {
  const { selectedPartId, select } = useViewerStore();
  const pc = useQuery({ queryKey: ['pc', pcId], queryFn: () => api.getPC(pcId) });
  const part = pc.data?.parts.find((p) => p.id === selectedPartId);

  return (
    <AnimatePresence>
      {part && (
        <motion.aside
          initial={{ x: '105%' }}
          animate={{ x: 0 }}
          exit={{ x: '105%' }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          className="glass absolute inset-y-3 right-3 z-10 w-72 overflow-y-auto border-neon-cyan/30 p-4 shadow-glow-cyan"
        >
          <div className="mb-3 flex items-start justify-between gap-2">
            <TypeBadge type={part.type} />
            <button onClick={() => select(null)} className="text-slate-500 hover:text-neon-red" aria-label="Close panel">
              <X size={16} />
            </button>
          </div>
          <h3 className="font-display text-base font-bold text-slate-100">
            {part.brand} {part.model}
          </h3>
          <div className="mt-3 space-y-2.5 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Condition</span><ConditionBadge condition={part.condition} /></div>
            <div className="flex justify-between"><span className="text-slate-500">Age</span><span className="text-slate-200">{formatAge(part.purchase_date)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Price</span><span className="font-mono text-neon-cyan">{formatMoney(part.purchase_price)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Warranty</span><span className="text-slate-200">{formatDate(part.warranty_expiry)}</span></div>
            {part.serial_number && (
              <div>
                <span className="text-slate-500">Serial</span>
                <p className="mt-0.5 break-all font-mono text-xs text-neon-violet">{part.serial_number}</p>
              </div>
            )}
            {part.specs && Object.keys(part.specs).length > 0 && (
              <div className="border-t border-line pt-2">
                <span className="text-[10px] uppercase tracking-widest text-slate-500">Specs</span>
                <dl className="mt-1.5 space-y-1">
                  {Object.entries(part.specs).map(([key, value]) => (
                    <div key={key} className="flex justify-between gap-2 text-xs">
                      <dt className="font-mono text-slate-500">{key}</dt>
                      <dd className="text-right text-slate-300">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
          <Link href={`/parts/view?id=${part.id}`}>
            <Button className="mt-4 w-full" size="sm">Full part dossier →</Button>
          </Link>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function PCDetailContent() {
  const params = useSearchParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.get('id') ?? '';
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isAdmin = useIsAdmin();
  const select = useViewerStore((s) => s.select);

  // reset 3D selection when navigating between PCs
  useEffect(() => () => select(null), [id, select]);

  const pc = useQuery({
    queryKey: ['pc', id],
    queryFn: () => api.getPC(id),
    enabled: id.length > 0,
  });

  const del = useMutation({
    mutationFn: () => api.deletePC(id),
    onSuccess: () => {
      queryClient.invalidateQueries();
      router.push('/pcs');
    },
  });

  const downloadQR = async () => {
    const res = await fetch(api.qrImageUrl(id));
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pc-vault-${pc.data?.name ?? 'qr'}.png`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!id) return <ErrorState message="No PC id supplied. Open a machine from the fleet page." />;
  if (pc.isPending) return <PageLoader label="Materializing" />;
  if (pc.isError) return <ErrorState message={(pc.error as Error).message} />;

  const data = pc.data;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/pcs" className="text-slate-500 transition-colors hover:text-neon-cyan" aria-label="Back to PCs">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display text-2xl font-bold text-slate-100">{data.name}</h1>
        <StatusBadge status={data.status} />
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={downloadQR}>
            <Download size={14} /> <QrCode size={14} /> QR
          </Button>
          {isAdmin && (
            <>
              <Link href={`/pcs/edit?id=${data.id}`}>
                <Button variant="outline" size="sm"><Pencil size={14} /> Edit</Button>
              </Link>
              <Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 size={14} />
              </Button>
            </>
          )}
        </div>
      </header>

      {data.description && <p className="mb-5 max-w-2xl text-sm text-slate-400">{data.description}</p>}

      {/* ── 3D viewer ─────────────────────────────────────────────── */}
      <div className="glass relative mb-6 h-[420px] overflow-hidden border-neon-violet/20 md:h-[520px]">
        <PCViewer parts={data.parts} pcId={data.id} />
        <PartSidePanel pcId={id} />
        <p className="pointer-events-none absolute bottom-3 left-4 font-mono text-[10px] text-slate-600">
          drag to orbit · click a labelled pin to inspect
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* spec table */}
        <GlassCard className="lg:col-span-2">
          <CardTitle className="mb-4">Loadout — {data.parts.length} components</CardTitle>
          {data.parts.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Empty chassis. Assign parts from the inventory.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-widest text-slate-500">
                    <th className="pb-2 pr-3">Type</th>
                    <th className="pb-2 pr-3">Component</th>
                    <th className="pb-2 pr-3">Condition</th>
                    <th className="pb-2 pr-3">Age</th>
                    <th className="pb-2 text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {data.parts.map((part) => (
                    <tr
                      key={part.id}
                      className="cursor-pointer border-b border-line/50 transition-colors last:border-0 hover:bg-neon-cyan/5"
                      onClick={() => select(part.id)}
                    >
                      <td className="py-2.5 pr-3 font-mono text-xs text-neon-violet">
                        {PART_TYPE_LABELS[part.type]}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-200">{part.brand} {part.model}</td>
                      <td className="py-2.5 pr-3"><ConditionBadge condition={part.condition} /></td>
                      <td className="py-2.5 pr-3 text-slate-400">{formatAge(part.purchase_date)}</td>
                      <td className="py-2.5 text-right font-mono text-neon-cyan">{formatMoney(part.purchase_price)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} className="pt-3 text-right text-xs uppercase tracking-widest text-slate-500">
                      Total value
                    </td>
                    <td className="pt-3 text-right font-display font-bold text-neon-cyan">
                      {formatMoney(data.total_value)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>

        {/* network + meta */}
        <div className="space-y-6">
          <NetworkPanel pcId={id} />
          <GlassCard>
            <CardTitle className="mb-3">Registry data</CardTitle>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Build date</dt><dd className="text-slate-200">{formatDate(data.build_date)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Registered</dt><dd className="text-slate-200">{formatDate(data.created_at)}</dd></div>
              <div>
                <dt className="text-slate-500">QR token</dt>
                <dd className="mt-1 break-all font-mono text-[11px] text-neon-violet">{data.qr_code}</dd>
              </div>
            </dl>
          </GlassCard>
        </div>
      </div>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Decommission PC">
        <p className="text-sm text-slate-300">
          Delete <span className="font-bold text-neon-red">{data.name}</span>? Its parts return
          to inventory; network info is destroyed. This cannot be undone.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          <Button variant="danger" disabled={del.isPending} onClick={() => del.mutate()}>
            {del.isPending ? 'Deleting…' : 'Delete PC'}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

export default function PCDetailPage() {
  return (
    <Suspense fallback={<PageLoader label="Materializing" />}>
      <PCDetailContent />
    </Suspense>
  );
}
