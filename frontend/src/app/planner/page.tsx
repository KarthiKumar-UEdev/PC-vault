'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ExternalLink, Plus, Rocket, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ConditionBadge, TypeBadge } from '@/components/badges';
import { Button } from '@/components/ui/button';
import { CardTitle, GlassCard } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { PART_CATALOGS } from '@/lib/catalog';
import type { BuildDetail, PartType } from '@/lib/types';
import { PART_TYPE_LABELS, PART_TYPES } from '@/lib/types';
import { cn, formatMoney } from '@/lib/utils';

const CUSTOM_PICK = '__custom__';

/* which core slots a build needs, and keywords to recognize external items */
const CHECKLIST: { label: string; types: PartType[]; keywords: RegExp }[] = [
  { label: 'CPU', types: ['cpu'], keywords: /\b(cpu|ryzen|core i\d|xeon|threadripper)\b/i },
  { label: 'Motherboard', types: ['mobo'], keywords: /\b(mobo|motherboard|b\d{3}|x\d{3}|z\d{3})\b/i },
  { label: 'RAM', types: ['ram'], keywords: /\b(ram|ddr\d|memory)\b/i },
  { label: 'Storage', types: ['ssd', 'hdd'], keywords: /\b(ssd|hdd|nvme|drive)\b/i },
  { label: 'PSU', types: ['psu'], keywords: /\b(psu|power supply|\d{3,4}\s?w)\b/i },
  { label: 'Case', types: ['case'], keywords: /\b(case|tower|chassis)\b/i },
  { label: 'Cooler', types: ['cooler'], keywords: /\b(cooler|aio|heatsink)\b/i },
  { label: 'GPU', types: ['gpu'], keywords: /\b(gpu|rtx|gtx|radeon|rx \d)\b/i },
];

function MissingChecklist({ build }: { build: BuildDetail }) {
  return (
    <ul className="grid grid-cols-2 gap-2">
      {CHECKLIST.map(({ label, types, keywords }) => {
        const covered = build.items.some((item) => {
          if (item.part) return types.includes(item.part.type);
          if (item.external_type) return types.includes(item.external_type);
          return item.external_name !== null && keywords.test(item.external_name);
        });
        return (
          <li
            key={label}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs',
              covered
                ? 'border-neon-green/40 bg-neon-green/10 text-neon-green'
                : 'border-neon-red/30 bg-neon-red/5 text-slate-500',
            )}
          >
            {covered ? <Check size={13} /> : <X size={13} className="text-neon-red/70" />}
            {label}
          </li>
        );
      })}
    </ul>
  );
}

export default function PlannerPage() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newBuild, setNewBuild] = useState({ name: '', notes: '' });
  const [pickingPart, setPickingPart] = useState(false);
  const [external, setExternal] = useState({
    type: 'gpu' as PartType,
    pick: '',       // catalog selection, CUSTOM_PICK, or '' when type has no catalog
    name: '',       // free-text model name
    price: '',
    url: '',
  });

  const catalog = PART_CATALOGS[external.type];
  const usingCatalog = catalog !== undefined && external.pick !== CUSTOM_PICK;
  const externalName = usingCatalog ? external.pick : external.name.trim();

  const builds = useQuery({ queryKey: ['builds'], queryFn: api.listBuilds });
  const selectedId = activeBuildId ?? builds.data?.[0]?.id ?? null;

  const build = useQuery({
    queryKey: ['build', selectedId],
    queryFn: () => api.getBuild(selectedId!),
    enabled: selectedId !== null,
  });

  const inventory = useQuery({
    queryKey: ['parts', 'inventory'],
    queryFn: () => api.listParts({ in_inventory: true }),
    enabled: pickingPart,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['builds'] });
    queryClient.invalidateQueries({ queryKey: ['build', selectedId] });
  };

  const createBuild = useMutation({
    mutationFn: () => api.createBuild({ name: newBuild.name.trim(), notes: newBuild.notes.trim() || null }),
    onSuccess: (created) => {
      setCreating(false);
      setNewBuild({ name: '', notes: '' });
      setActiveBuildId(created.id);
      queryClient.invalidateQueries({ queryKey: ['builds'] });
    },
  });

  const addPart = useMutation({
    mutationFn: (partId: string) => api.addBuildItem(selectedId!, { part_id: partId }),
    onSuccess: invalidate,
  });

  const addExternal = useMutation({
    mutationFn: () =>
      api.addBuildItem(selectedId!, {
        external_type: external.type,
        external_name: externalName,
        external_price: external.price || undefined,
        external_url: external.url.trim() || undefined,
      }),
    onSuccess: () => {
      setExternal((x) => ({ ...x, pick: '', name: '', price: '', url: '' }));
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

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">
            Build <span className="neon-text">Planner</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">// blueprint your next machine</p>
        </div>
        <Button variant="solid" onClick={() => setCreating(true)}>
          <Plus size={16} /> New blueprint
        </Button>
      </header>

      {builds.data.length === 0 ? (
        <div className="glass p-12 text-center text-slate-500">
          <p className="font-display text-sm uppercase tracking-widest">No blueprints</p>
          <p className="mt-2 text-sm">Start a new build plan to mix inventory parts with wishlist items.</p>
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
            <PageLoader label="Loading blueprint" />
          ) : build.data ? (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* items */}
              <GlassCard className="lg:col-span-2">
                <div className="mb-4 flex items-center justify-between">
                  <CardTitle>{build.data.name}</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setPickingPart(true)}>
                      <Plus size={13} /> From inventory
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => deleteBuild.mutate()}>
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
                {build.data.notes && <p className="mb-4 text-sm text-slate-400">{build.data.notes}</p>}

                {build.data.items.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-500">
                    Empty blueprint — add inventory parts or wishlist items.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {build.data.items.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center gap-3 rounded-lg border border-line bg-panel-2/50 px-3 py-2.5 text-sm"
                      >
                        {item.part ? (
                          <>
                            <TypeBadge type={item.part.type} />
                            <span className="min-w-0 flex-1 truncate text-slate-200">
                              {item.part.brand} {item.part.model}
                            </span>
                            <ConditionBadge condition={item.part.condition} />
                            <span className="font-mono text-xs text-neon-green">owned</span>
                            <span className="font-mono text-neon-cyan">{formatMoney(item.part.purchase_price)}</span>
                          </>
                        ) : (
                          <>
                            {item.external_type && <TypeBadge type={item.external_type} />}
                            <span className="min-w-0 flex-1 truncate text-slate-200">{item.external_name}</span>
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
                            <span className="font-mono text-xs text-neon-amber">to buy</span>
                            <span className="font-mono text-neon-cyan">{formatMoney(item.external_price)}</span>
                          </>
                        )}
                        <button
                          onClick={() => removeItem.mutate(item.id)}
                          className="text-slate-600 transition-colors hover:text-neon-red"
                          aria-label="Remove item"
                        >
                          <X size={15} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* add external */}
                <div className="mt-5 border-t border-line pt-4">
                  <Label>Add external part (wishlist)</Label>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Select
                        className="w-40"
                        value={external.type}
                        onChange={(e) =>
                          setExternal((x) => ({
                            ...x,
                            type: e.target.value as PartType,
                            pick: '',
                            name: '',
                            price: '',
                          }))
                        }
                      >
                        {PART_TYPES.map((t) => (
                          <option key={t} value={t}>{PART_TYPE_LABELS[t]}</option>
                        ))}
                      </Select>
                      {catalog ? (
                        <Select
                          className="min-w-48 flex-1"
                          value={external.pick}
                          onChange={(e) => {
                            const pick = e.target.value;
                            const entry = catalog.find((c) => c.label === pick);
                            setExternal((x) => ({
                              ...x,
                              pick,
                              price: entry ? String(entry.price) : x.price,
                            }));
                          }}
                        >
                          <option value="">— pick a {PART_TYPE_LABELS[external.type]} —</option>
                          {catalog.map((entry) => (
                            <option key={entry.label} value={entry.label}>
                              {entry.label} · {formatMoney(entry.price)}
                            </option>
                          ))}
                          <option value={CUSTOM_PICK}>Other / custom model…</option>
                        </Select>
                      ) : null}
                      {(!catalog || external.pick === CUSTOM_PICK) && (
                        <Input
                          className="min-w-48 flex-1"
                          placeholder={`${PART_TYPE_LABELS[external.type]} model name`}
                          value={external.name}
                          onChange={(e) => setExternal((x) => ({ ...x, name: e.target.value }))}
                        />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        className="w-32" type="number" min="0" step="1" placeholder="₹ price"
                        value={external.price}
                        onChange={(e) => setExternal((x) => ({ ...x, price: e.target.value }))}
                      />
                      <Input
                        className="min-w-40 flex-1" placeholder="https://… (product link)"
                        value={external.url}
                        onChange={(e) => setExternal((x) => ({ ...x, url: e.target.value }))}
                      />
                      <Button
                        disabled={!externalName || addExternal.isPending}
                        onClick={() => addExternal.mutate()}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                </div>
              </GlassCard>

              {/* cost + checklist + convert */}
              <div className="space-y-6">
                <GlassCard className="text-center">
                  <CardTitle>Projected cost</CardTitle>
                  <p className="mt-3 font-display text-4xl font-bold text-neon-cyan drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]">
                    {formatMoney(build.data.total_cost)}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500">
                    owned value + wishlist prices
                  </p>
                </GlassCard>
                <GlassCard>
                  <CardTitle className="mb-3">Loadout checklist</CardTitle>
                  <MissingChecklist build={build.data} />
                </GlassCard>
                <Button
                  variant="solid"
                  className="w-full"
                  size="lg"
                  disabled={convert.isPending || build.data.items.every((i) => !i.part)}
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
          ) : null}
        </>
      )}

      {/* new build dialog */}
      <Dialog open={creating} onClose={() => setCreating(false)} title="New blueprint">
        <div className="space-y-3">
          <div>
            <Label>Name *</Label>
            <Input
              value={newBuild.name} placeholder="Project Nebula"
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
          <Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button>
          <Button
            variant="solid"
            disabled={!newBuild.name.trim() || createBuild.isPending}
            onClick={() => createBuild.mutate()}
          >
            Create
          </Button>
        </div>
      </Dialog>

      {/* pick inventory part dialog */}
      <Dialog open={pickingPart} onClose={() => setPickingPart(false)} title="Add from inventory">
        {inventory.isPending ? (
          <PageLoader label="Opening vault" />
        ) : (inventory.data?.length ?? 0) === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Inventory is empty.</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto pr-1">
            {inventory.data!
              .filter((part) => !build.data?.items.some((i) => i.part_id === part.id))
              .map((part) => (
                <li key={part.id}>
                  <button
                    className="flex w-full items-center gap-3 rounded-lg border border-line bg-panel-2/50 px-3 py-2 text-left text-sm transition-all hover:border-neon-cyan/40"
                    onClick={() => {
                      addPart.mutate(part.id);
                      setPickingPart(false);
                    }}
                  >
                    <TypeBadge type={part.type} />
                    <span className="flex-1 truncate text-slate-200">{part.brand} {part.model}</span>
                    <span className="font-mono text-xs text-neon-cyan">{formatMoney(part.purchase_price)}</span>
                  </button>
                </li>
              ))}
          </ul>
        )}
      </Dialog>
    </div>
  );
}
