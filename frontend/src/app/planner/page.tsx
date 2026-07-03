'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ExternalLink, Plus, Rocket, ShieldCheck, Trash2, X, Zap,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ConditionBadge, TypeBadge } from '@/components/badges';
import { Button } from '@/components/ui/button';
import { CardTitle, GlassCard } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input, Label, Textarea } from '@/components/ui/input';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { PART_CATALOGS } from '@/lib/catalog';
import { checkCompatibility } from '@/lib/compat';
import type { BuildDetail, BuildItem, PartType } from '@/lib/types';
import { PART_TYPE_LABELS } from '@/lib/types';
import { cn, formatMoney } from '@/lib/utils';

/* PCPartPicker-style slot table: one row per component category. */
const SLOTS: { type: PartType; label: string; multi: boolean }[] = [
  { type: 'cpu', label: 'CPU', multi: false },
  { type: 'cooler', label: 'CPU Cooler', multi: false },
  { type: 'mobo', label: 'Motherboard', multi: false },
  { type: 'ram', label: 'Memory', multi: true },
  { type: 'ssd', label: 'SSD', multi: true },
  { type: 'hdd', label: 'HDD', multi: true },
  { type: 'gpu', label: 'Graphics Card', multi: true },
  { type: 'case', label: 'Case', multi: false },
  { type: 'psu', label: 'Power Supply', multi: false },
  { type: 'fan', label: 'Case Fans', multi: true },
  { type: 'other', label: 'Other', multi: true },
];

function itemType(item: BuildItem): PartType {
  return item.part?.type ?? item.external_type ?? 'other';
}

function itemPrice(item: BuildItem): string | null {
  return item.part ? item.part.purchase_price : item.external_price;
}

/* ── slot row ──────────────────────────────────────────────────────────── */

function SlotRow({
  slot,
  items,
  onChoose,
  onRemove,
}: {
  slot: (typeof SLOTS)[number];
  items: BuildItem[];
  onChoose: () => void;
  onRemove: (itemId: string) => void;
}) {
  // hide never-used optional rows so the table stays tight
  if (items.length === 0 && (slot.type === 'fan' || slot.type === 'other')) return null;

  return (
    <div className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0 sm:flex-row sm:items-start">
      <span className="w-32 shrink-0 pt-1.5 font-mono text-[11px] uppercase tracking-wider text-slate-500">
        {slot.label}
      </span>
      <div className="min-w-0 flex-1 space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-line bg-panel-2/50 px-3 py-2 text-sm"
          >
            <span className="min-w-0 flex-1 truncate text-slate-200">
              {item.part ? `${item.part.brand} ${item.part.model}` : item.external_name}
            </span>
            {item.part && <ConditionBadge condition={item.part.condition} />}
            {item.external_url && (
              <a
                href={item.external_url}
                target="_blank"
                rel="noreferrer"
                className="text-neon-violet hover:text-neon-cyan"
                aria-label="Open product link"
              >
                <ExternalLink size={14} />
              </a>
            )}
            <span
              className={cn(
                'shrink-0 font-mono text-[10px] uppercase',
                item.part ? 'text-neon-green' : 'text-neon-amber',
              )}
            >
              {item.part ? 'owned' : 'to buy'}
            </span>
            <span className="shrink-0 font-mono text-neon-cyan">{formatMoney(itemPrice(item))}</span>
            <button
              onClick={() => onRemove(item.id)}
              className="text-slate-600 transition-colors hover:text-neon-red"
              aria-label={`Remove ${slot.label}`}
            >
              <X size={15} />
            </button>
          </div>
        ))}
        {(items.length === 0 || slot.multi) && (
          <button
            onClick={onChoose}
            className="flex w-full items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-sm text-slate-500 transition-all hover:border-neon-cyan/50 hover:text-neon-cyan"
          >
            <Plus size={14} />
            {items.length === 0 ? `Choose a ${slot.label}` : `Add another ${slot.label}`}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── part picker dialog (inventory | catalog | custom) ─────────────────── */

function PartPicker({
  type,
  buildItems,
  onPickInventory,
  onPickExternal,
  onClose,
}: {
  type: PartType;
  buildItems: BuildItem[];
  onPickInventory: (partId: string) => void;
  onPickExternal: (data: { name: string; price: string; url: string }) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'inventory' | 'shop'>('shop');
  const [custom, setCustom] = useState({ name: '', price: '', url: '' });

  const inventory = useQuery({
    queryKey: ['parts', 'inventory', type],
    queryFn: () => api.listParts({ in_inventory: true, type }),
  });
  const inBuild = new Set(buildItems.map((i) => i.part_id).filter(Boolean));
  const available = (inventory.data ?? []).filter((p) => !inBuild.has(p.id));
  const catalog = PART_CATALOGS[type] ?? [];

  return (
    <Dialog open onClose={onClose} title={`Choose a ${PART_TYPE_LABELS[type]}`}>
      <div className="mb-4 flex gap-2">
        {(['shop', 'inventory'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs uppercase tracking-wider transition-all',
              tab === t
                ? 'border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan'
                : 'border-line text-slate-500 hover:border-neon-cyan/30',
            )}
          >
            {t === 'shop' ? 'Buy new' : `My inventory (${available.length})`}
          </button>
        ))}
      </div>

      {tab === 'inventory' ? (
        inventory.isPending ? (
          <PageLoader label="Opening vault" />
        ) : available.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            No unassigned {PART_TYPE_LABELS[type]} in inventory.
          </p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {available.map((part) => (
              <li key={part.id}>
                <button
                  className="flex w-full items-center gap-3 rounded-lg border border-line bg-panel-2/50 px-3 py-2 text-left text-sm transition-all hover:border-neon-cyan/40"
                  onClick={() => onPickInventory(part.id)}
                >
                  <TypeBadge type={part.type} />
                  <span className="flex-1 truncate text-slate-200">
                    {part.brand} {part.model}
                  </span>
                  <ConditionBadge condition={part.condition} />
                  <span className="font-mono text-xs text-neon-cyan">
                    {formatMoney(part.purchase_price)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="space-y-4">
          {catalog.length > 0 && (
            <ul className="max-h-60 space-y-2 overflow-y-auto pr-1">
              {catalog.map((entry) => (
                <li key={entry.label}>
                  <button
                    className="flex w-full items-center gap-3 rounded-lg border border-line bg-panel-2/50 px-3 py-2 text-left text-sm transition-all hover:border-neon-cyan/40"
                    onClick={() =>
                      onPickExternal({ name: entry.label, price: String(entry.price), url: '' })
                    }
                  >
                    <span className="flex-1 truncate text-slate-200">{entry.label}</span>
                    {entry.specs?.socket && (
                      <span className="font-mono text-[10px] text-slate-500">{entry.specs.socket}</span>
                    )}
                    {entry.specs?.mem_type && !entry.specs.socket && (
                      <span className="font-mono text-[10px] text-slate-500">{entry.specs.mem_type}</span>
                    )}
                    {entry.specs?.watts && (
                      <span className="font-mono text-[10px] text-slate-500">{entry.specs.watts}W</span>
                    )}
                    <span className="font-mono text-xs text-neon-cyan">{formatMoney(entry.price)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-line pt-3">
            <Label>Custom {PART_TYPE_LABELS[type]}</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                className="min-w-40 flex-1"
                placeholder="Model name"
                value={custom.name}
                onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))}
              />
              <Input
                className="w-28"
                type="number"
                min="0"
                placeholder="₹ price"
                value={custom.price}
                onChange={(e) => setCustom((c) => ({ ...c, price: e.target.value }))}
              />
            </div>
            <div className="mt-2 flex gap-2">
              <Input
                className="flex-1"
                placeholder="https://… (product link, optional)"
                value={custom.url}
                onChange={(e) => setCustom((c) => ({ ...c, url: e.target.value }))}
              />
              <Button
                disabled={!custom.name.trim()}
                onClick={() => onPickExternal({ ...custom, name: custom.name.trim() })}
              >
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}

/* ── compatibility banner ──────────────────────────────────────────────── */

function CompatBanner({ build }: { build: BuildDetail }) {
  const report = useMemo(() => checkCompatibility(build.items), [build.items]);
  const errors = report.issues.filter((i) => i.severity === 'error');
  const warnings = report.issues.filter((i) => i.severity === 'warning');

  return (
    <div className="space-y-3">
      <div
        className={cn(
          'flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border px-4 py-3',
          errors.length > 0
            ? 'border-neon-red/40 bg-neon-red/5'
            : warnings.length > 0
              ? 'border-neon-amber/40 bg-neon-amber/5'
              : 'border-neon-green/40 bg-neon-green/5',
        )}
      >
        <span
          className={cn(
            'flex items-center gap-2 text-sm font-medium',
            errors.length > 0 ? 'text-neon-red' : warnings.length > 0 ? 'text-neon-amber' : 'text-neon-green',
          )}
        >
          {errors.length > 0 ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
          {errors.length > 0
            ? `${errors.length} compatibility issue${errors.length > 1 ? 's' : ''}`
            : warnings.length > 0
              ? `${warnings.length} note${warnings.length > 1 ? 's' : ''}`
              : 'Compatible: no issues found'}
        </span>
        {report.estimatedWatts !== null && (
          <span className="flex items-center gap-1.5 font-mono text-xs text-slate-400">
            <Zap size={13} className="text-neon-amber" />
            est. load ~{report.estimatedWatts}W
            {report.psuWatts !== null && <> · PSU {report.psuWatts}W</>}
            {report.psuWatts === null && report.recommendedPsuWatts !== null && (
              <> · get ≥{report.recommendedPsuWatts}W</>
            )}
          </span>
        )}
      </div>
      {report.issues.length > 0 && (
        <ul className="space-y-1.5">
          {report.issues.map((issue) => (
            <li
              key={issue.message}
              className={cn(
                'flex items-start gap-2 text-xs',
                issue.severity === 'error' ? 'text-neon-red' : 'text-neon-amber',
              )}
            >
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {issue.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */

export default function PlannerPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newBuild, setNewBuild] = useState({ name: '', notes: '' });
  const [pickingType, setPickingType] = useState<PartType | null>(null);

  const builds = useQuery({ queryKey: ['builds'], queryFn: api.listBuilds });
  const selectedId = activeBuildId ?? builds.data?.[0]?.id ?? null;

  const build = useQuery({
    queryKey: ['build', selectedId],
    queryFn: () => api.getBuild(selectedId!),
    enabled: selectedId !== null,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['builds'] });
    queryClient.invalidateQueries({ queryKey: ['build', selectedId] });
  };

  const createBuild = useMutation({
    mutationFn: () =>
      api.createBuild({ name: newBuild.name.trim(), notes: newBuild.notes.trim() || null }),
    onSuccess: (created) => {
      setCreating(false);
      setNewBuild({ name: '', notes: '' });
      setActiveBuildId(created.id);
      queryClient.invalidateQueries({ queryKey: ['builds'] });
    },
  });

  const addPart = useMutation({
    mutationFn: (partId: string) => api.addBuildItem(selectedId!, { part_id: partId }),
    onSuccess: () => {
      setPickingType(null);
      invalidate();
    },
  });

  const addExternal = useMutation({
    mutationFn: (data: { type: PartType; name: string; price: string; url: string }) =>
      api.addBuildItem(selectedId!, {
        external_type: data.type,
        external_name: data.name,
        external_price: data.price || undefined,
        external_url: data.url.trim() || undefined,
      }),
    onSuccess: () => {
      setPickingType(null);
      invalidate();
    },
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => api.removeBuildItem(selectedId!, itemId),
    onSuccess: invalidate,
  });

  const deleteBuild = useMutation({
    mutationFn: () => api.deleteBuild(selectedId!),
    onSuccess: () => {
      setActiveBuildId(null);
      queryClient.invalidateQueries();
    },
  });

  const convert = useMutation({
    mutationFn: () => api.convertBuild(selectedId!),
    onSuccess: (pc) => {
      queryClient.invalidateQueries();
      router.push(`/pcs/view?id=${pc.id}`);
    },
  });

  if (builds.isPending) return <PageLoader label="Loading blueprints" />;
  if (builds.isError) return <ErrorState message={(builds.error as Error).message} />;

  const items = build.data?.items ?? [];
  const ownedCost = items
    .filter((i) => i.part)
    .reduce((sum, i) => sum + parseFloat(itemPrice(i) ?? '0'), 0);
  const buyCost = items
    .filter((i) => !i.part)
    .reduce((sum, i) => sum + parseFloat(itemPrice(i) ?? '0'), 0);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">
            System <span className="neon-text">Builder</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">
            // pick every component, we check the fit
          </p>
        </div>
        <Button variant="solid" onClick={() => setCreating(true)}>
          <Plus size={16} /> New build
        </Button>
      </header>

      {builds.data.length === 0 ? (
        <div className="glass p-12 text-center text-slate-500">
          <p className="font-display text-sm uppercase tracking-widest">No builds yet</p>
          <p className="mt-2 text-sm">
            Start a build to combine inventory parts with shop wishlist items — compatibility and
            wattage are checked as you go.
          </p>
        </div>
      ) : (
        <>
          {/* build tabs */}
          <div className="mb-6 flex flex-wrap gap-2">
            {builds.data.map((b) => (
              <button
                key={b.id}
                onClick={() => setActiveBuildId(b.id)}
                className={cn(
                  'rounded-lg border px-4 py-2 text-sm transition-all',
                  b.id === selectedId
                    ? 'border-neon-cyan/60 bg-neon-cyan/10 text-neon-cyan shadow-glow-cyan'
                    : 'border-line text-slate-400 hover:border-neon-cyan/30',
                )}
              >
                {b.name}
                <span className="ml-2 font-mono text-[10px] text-slate-500">{b.item_count}</span>
              </button>
            ))}
          </div>

          {build.isPending ? (
            <PageLoader label="Loading build" />
          ) : build.data ? (
            <div className="space-y-5">
              <CompatBanner build={build.data} />

              <div className="grid gap-6 lg:grid-cols-3">
                {/* slot table */}
                <GlassCard className="p-0 lg:col-span-2">
                  <div className="flex items-center justify-between border-b border-line px-4 py-3">
                    <CardTitle>{build.data.name}</CardTitle>
                    <Button variant="danger" size="sm" onClick={() => deleteBuild.mutate()}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                  {build.data.notes && (
                    <p className="border-b border-line px-4 py-2.5 text-sm text-slate-400">
                      {build.data.notes}
                    </p>
                  )}
                  {SLOTS.map((slot) => (
                    <SlotRow
                      key={slot.type}
                      slot={slot}
                      items={items.filter((i) => itemType(i) === slot.type)}
                      onChoose={() => setPickingType(slot.type)}
                      onRemove={(itemId) => removeItem.mutate(itemId)}
                    />
                  ))}
                </GlassCard>

                {/* totals + convert */}
                <div className="space-y-6">
                  <GlassCard className="text-center">
                    <CardTitle>Projected cost</CardTitle>
                    <p className="mt-3 font-display text-4xl font-bold text-neon-cyan drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]">
                      {formatMoney(build.data.total_cost)}
                    </p>
                    <div className="mt-3 flex justify-center gap-6 font-mono text-[11px]">
                      <span className="text-neon-green">owned {formatMoney(ownedCost)}</span>
                      <span className="text-neon-amber">to buy {formatMoney(buyCost)}</span>
                    </div>
                  </GlassCard>
                  <Button
                    variant="solid"
                    className="w-full"
                    size="lg"
                    disabled={convert.isPending || items.every((i) => !i.part)}
                    onClick={() => convert.mutate()}
                    title="Creates a real PC and installs all owned parts"
                  >
                    <Rocket size={16} />
                    {convert.isPending ? 'Assembling…' : 'Convert to real PC'}
                  </Button>
                  <p className="text-center font-mono text-[10px] text-slate-600">
                    installs owned parts · wishlist items are dropped
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      {/* new build dialog */}
      <Dialog open={creating} onClose={() => setCreating(false)} title="New build">
        <div className="space-y-3">
          <div>
            <Label>Name *</Label>
            <Input
              value={newBuild.name}
              placeholder="Project Nebula"
              onChange={(e) => setNewBuild((b) => ({ ...b, name: e.target.value }))}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={newBuild.notes}
              onChange={(e) => setNewBuild((b) => ({ ...b, notes: e.target.value }))}
            />
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setCreating(false)}>
            Cancel
          </Button>
          <Button
            variant="solid"
            disabled={!newBuild.name.trim() || createBuild.isPending}
            onClick={() => createBuild.mutate()}
          >
            Create
          </Button>
        </div>
      </Dialog>

      {/* slot part picker */}
      {pickingType && build.data && (
        <PartPicker
          type={pickingType}
          buildItems={items}
          onPickInventory={(partId) => addPart.mutate(partId)}
          onPickExternal={(data) => addExternal.mutate({ type: pickingType, ...data })}
          onClose={() => setPickingType(null)}
        />
      )}
    </div>
  );
}
