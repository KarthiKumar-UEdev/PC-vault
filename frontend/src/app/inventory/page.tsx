'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRightLeft, Package, Plus } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { ConditionBadge, TypeBadge } from '@/components/badges';
import { PartFormDialog } from '@/components/part-form-dialog';
import { TransferDialog } from '@/components/transfer-dialog';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { Part } from '@/lib/types';
import { PART_CONDITIONS, PART_TYPE_LABELS, PART_TYPES } from '@/lib/types';
import { formatAge, formatMoney } from '@/lib/utils';

export default function InventoryPage() {
  const [type, setType] = useState('');
  const [condition, setCondition] = useState('');
  const [creating, setCreating] = useState(false);
  const [transferPart, setTransferPart] = useState<Part | null>(null);

  const parts = useQuery({
    queryKey: ['parts', 'inventory', { type, condition }],
    queryFn: () =>
      api.listParts({
        in_inventory: true,
        type: type || undefined,
        condition: condition || undefined,
      }),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">
            Parts <span className="neon-text">Vault</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">// unassigned components</p>
        </div>
        <Button variant="solid" onClick={() => setCreating(true)}>
          <Plus size={16} /> Register part
        </Button>
      </header>

      <div className="glass mb-6 flex flex-wrap items-center gap-3 p-3">
        <Package size={16} className="ml-1 text-neon-violet" />
        <Select className="w-40" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {PART_TYPES.map((t) => (
            <option key={t} value={t}>{PART_TYPE_LABELS[t]}</option>
          ))}
        </Select>
        <Select className="w-40" value={condition} onChange={(e) => setCondition(e.target.value)}>
          <option value="">All conditions</option>
          {PART_CONDITIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <span className="ml-auto font-mono text-xs text-slate-500">
          {parts.data?.length ?? '—'} items
        </span>
      </div>

      {parts.isPending ? (
        <PageLoader label="Opening vault" />
      ) : parts.isError ? (
        <ErrorState message={(parts.error as Error).message} />
      ) : parts.data.length === 0 ? (
        <div className="glass p-12 text-center text-slate-500">
          <p className="font-display text-sm uppercase tracking-widest">Vault empty</p>
          <p className="mt-2 text-sm">Every part is installed, or none are registered yet.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {parts.data.map((part, i) => (
            <motion.div
              key={part.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <GlassCard className="glass-hover flex h-full flex-col">
                <div className="flex items-start justify-between gap-2">
                  <TypeBadge type={part.type} />
                  <ConditionBadge condition={part.condition} />
                </div>
                <Link href={`/parts/view?id=${part.id}`} className="group mt-3 block flex-1">
                  <h3 className="font-display text-base font-bold text-slate-100 transition-colors group-hover:text-neon-cyan">
                    {part.brand}
                  </h3>
                  <p className="text-sm text-slate-300">{part.model}</p>
                  {part.serial_number && (
                    <p className="mt-1 truncate font-mono text-[11px] text-slate-500">
                      SN {part.serial_number}
                    </p>
                  )}
                </Link>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <span className="text-xs text-slate-500">{formatAge(part.purchase_date)} old</span>
                  <span className="font-mono text-sm text-neon-cyan">{formatMoney(part.purchase_price)}</span>
                </div>
                <Button className="mt-3 w-full" size="sm" onClick={() => setTransferPart(part)}>
                  <ArrowRightLeft size={13} /> Assign to PC
                </Button>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}

      <PartFormDialog open={creating} onClose={() => setCreating(false)} />
      {transferPart && (
        <TransferDialog
          part={transferPart}
          open={transferPart !== null}
          onClose={() => setTransferPart(null)}
        />
      )}
    </div>
  );
}
