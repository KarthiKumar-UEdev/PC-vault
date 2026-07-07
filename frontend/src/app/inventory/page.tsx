'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowRightLeft, Boxes, Monitor, Package, Plus, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { AssignDialog } from '@/components/assign-dialog';
import { ConditionBadge, TypeBadge } from '@/components/badges';
import { PartFormDialog } from '@/components/part-form-dialog';
import { TransferDialog } from '@/components/transfer-dialog';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/card';
import { Select } from '@/components/ui/input';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { useIsAdmin } from '@/lib/use-role';
import type { Part, PartCategory } from '@/lib/types';
import { PART_CATEGORIES, PART_CONDITIONS, PART_TYPE_LABELS, partCategory } from '@/lib/types';
import { formatAge, formatMoney } from '@/lib/utils';

type Location = '' | 'inventory' | 'installed';

export default function InventoryPage() {
  const [category, setCategory] = useState<'' | PartCategory>('');
  const [type, setType] = useState('');
  const [condition, setCondition] = useState('');
  const [location, setLocation] = useState<Location>('');
  const [creating, setCreating] = useState(false);
  const isAdmin = useIsAdmin();
  const [transferPart, setTransferPart] = useState<Part | null>(null);
  const [assignPart, setAssignPart] = useState<Part | null>(null);

  const parts = useQuery({
    queryKey: ['parts', 'all', { type, condition, location }],
    queryFn: () =>
      api.listParts({
        in_inventory:
          location === 'inventory' ? true : location === 'installed' ? false : undefined,
        type: type || undefined,
        condition: condition || undefined,
      }),
  });

  // the API filters by exact type; category narrowing happens client-side
  const categoryTypes = category
    ? new Set(PART_CATEGORIES.find((c) => c.key === category)?.types ?? [])
    : null;
  const visible = (parts.data ?? []).filter(
    (p) => categoryTypes === null || categoryTypes.has(p.type),
  );
  const unassigned = visible.filter((p) => p.pc_id === null).length;

  const typeGroups = category
    ? PART_CATEGORIES.filter((c) => c.key === category)
    : PART_CATEGORIES;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">
            Asset <span className="neon-text">Vault</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">
            // parts, devices &amp; network gear — and where they live
          </p>
        </div>
        {isAdmin && (
          <Button variant="solid" onClick={() => setCreating(true)}>
            <Plus size={16} /> Register asset
          </Button>
        )}
      </header>

      <div className="glass mb-6 flex flex-wrap items-center gap-3 p-3">
        <Package size={16} className="ml-1 text-neon-violet" />
        <Select
          className="w-44"
          value={category}
          onChange={(e) => {
            const next = e.target.value as '' | PartCategory;
            setCategory(next);
            // drop a type filter that no longer belongs to the chosen category
            if (
              next &&
              type &&
              !PART_CATEGORIES.find((c) => c.key === next)?.types.includes(
                type as (typeof PART_CATEGORIES)[number]['types'][number],
              )
            ) {
              setType('');
            }
          }}
        >
          <option value="">All categories</option>
          {PART_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>{c.label}</option>
          ))}
        </Select>
        <Select className="w-44" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {typeGroups.map((group) => (
            <optgroup key={group.key} label={group.label}>
              {group.types.map((t) => (
                <option key={t} value={t}>{PART_TYPE_LABELS[t]}</option>
              ))}
            </optgroup>
          ))}
          {!category && <option value="other">{PART_TYPE_LABELS.other}</option>}
        </Select>
        <Select className="w-40" value={condition} onChange={(e) => setCondition(e.target.value)}>
          <option value="">All conditions</option>
          {PART_CONDITIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
        <span className="ml-auto font-mono text-xs text-slate-500">
          {parts.data ? `${visible.length} items · ${unassigned} unassigned` : '—'}
        </span>
      </div>

      {parts.isPending ? (
        <PageLoader label="Opening vault" />
      ) : parts.isError ? (
        <ErrorState message={(parts.error as Error).message} />
      ) : visible.length === 0 ? (
        <div className="glass p-12 text-center text-slate-500">
          <p className="font-display text-sm uppercase tracking-widest">Vault empty</p>
          <p className="mt-2 text-sm">
            {location === 'inventory'
              ? 'Every asset is installed, or none are registered yet.'
              : location === 'installed'
                ? 'No assets are installed in a PC right now.'
                : 'No assets match these filters.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((part, i) => (
            <motion.div
              key={part.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.6) }}
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
                <div className="mt-3">
                  {part.pc_id ? (
                    <Link
                      href={`/pcs/view?id=${part.pc_id}`}
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-neon-violet/40 bg-neon-violet/10 px-2.5 py-1 font-mono text-[11px] text-neon-violet transition-all hover:border-neon-violet/70 hover:shadow-[0_0_12px_rgba(167,139,250,0.25)]"
                    >
                      <Monitor size={12} className="shrink-0" />
                      <span className="truncate">{part.pc_name}</span>
                    </Link>
                  ) : part.employee_id ? (
                    <Link
                      href="/employees"
                      className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-neon-green/40 bg-neon-green/10 px-2.5 py-1 font-mono text-[11px] text-neon-green transition-all hover:border-neon-green/70"
                    >
                      <UserRound size={12} className="shrink-0" />
                      <span className="truncate">{part.employee_name}</span>
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-slate-500">
                      <Boxes size={12} className="shrink-0" /> in stock
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <span className="text-xs text-slate-500">{formatAge(part.purchase_date)} old</span>
                  <span className="font-mono text-sm text-neon-cyan">{formatMoney(part.purchase_price)}</span>
                </div>
                {isAdmin && partCategory(part.type) !== 'network' && (
                  partCategory(part.type) === 'devices' ? (
                    <Button className="mt-3 w-full" size="sm" onClick={() => setAssignPart(part)}>
                      <UserRound size={13} />
                      {part.employee_id ? 'Reassign' : 'Assign to employee'}
                    </Button>
                  ) : (
                    <Button className="mt-3 w-full" size="sm" onClick={() => setTransferPart(part)}>
                      <ArrowRightLeft size={13} />
                      {part.pc_id ? 'Transfer' : 'Assign to PC'}
                    </Button>
                  )
                )}
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
      {assignPart && (
        <AssignDialog
          part={assignPart}
          open={assignPart !== null}
          onClose={() => setAssignPart(null)}
        />
      )}
    </div>
  );
}
