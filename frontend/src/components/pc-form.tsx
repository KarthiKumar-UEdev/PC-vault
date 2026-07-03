'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ConditionBadge, TypeBadge } from '@/components/badges';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/card';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { PCStatus } from '@/lib/types';
import { cn, formatMoney } from '@/lib/utils';

const STEPS = ['PC details', 'Assign parts', 'Network'] as const;

interface Details {
  name: string;
  description: string;
  status: PCStatus;
  build_date: string;
}

export function PCForm({ pcId }: { pcId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const editing = pcId !== undefined;

  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<Details>({
    name: '', description: '', status: 'active', build_date: '',
  });
  const [selectedParts, setSelectedParts] = useState<Set<string>>(new Set());
  const [removedParts, setRemovedParts] = useState<Set<string>>(new Set());
  const [network, setNetwork] = useState({ ip_address: '', mac_address: '', notes: '' });
  const [touchNetwork, setTouchNetwork] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existing = useQuery({
    queryKey: ['pc', pcId],
    queryFn: () => api.getPC(pcId!),
    enabled: editing,
  });

  const existingNet = useQuery({
    queryKey: ['network', pcId],
    queryFn: () => api.getNetwork(pcId!),
    enabled: editing,
  });

  const inventory = useQuery({
    queryKey: ['parts', 'inventory'],
    queryFn: () => api.listParts({ in_inventory: true }),
  });

  useEffect(() => {
    if (existing.data) {
      setDetails({
        name: existing.data.name,
        description: existing.data.description ?? '',
        status: existing.data.status,
        build_date: existing.data.build_date ?? '',
      });
    }
  }, [existing.data]);

  useEffect(() => {
    if (existingNet.data) {
      setNetwork({
        ip_address: existingNet.data.ip_address ?? '',
        mac_address: existingNet.data.mac_address ?? '',
        notes: existingNet.data.notes ?? '',
      });
    }
  }, [existingNet.data]);

  const submit = useMutation({
    mutationFn: async () => {
      const payload = {
        name: details.name.trim(),
        description: details.description.trim() || null,
        status: details.status,
        build_date: details.build_date || null,
      };
      const pc = editing ? await api.updatePC(pcId!, payload) : await api.createPC(payload);
      // step 2: move chosen inventory parts in, evicted parts out
      for (const partId of Array.from(selectedParts)) {
        await api.transferPart(partId, pc.id);
      }
      for (const partId of Array.from(removedParts)) {
        await api.transferPart(partId, null);
      }
      // step 3: only touch network info if the user typed something
      if (touchNetwork) {
        await api.putNetwork(pc.id, {
          ip_address: network.ip_address || null,
          mac_address: network.mac_address || null,
          notes: network.notes || null,
        });
      }
      return pc;
    },
    onSuccess: (pc) => {
      queryClient.invalidateQueries();
      router.push(`/pcs/view?id=${pc.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  if (editing && existing.isPending) return <PageLoader label="Loading machine" />;
  if (editing && existing.isError) return <ErrorState message={(existing.error as Error).message} />;

  const detailsValid = details.name.trim().length > 0;
  const currentParts = (existing.data?.parts ?? []).filter((p) => !removedParts.has(p.id));

  const toggle = (id: string) =>
    setSelectedParts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 font-display text-2xl font-bold text-slate-100">
        {editing ? 'Reconfigure' : 'Register'} <span className="neon-text">Machine</span>
      </h1>

      {/* step indicator */}
      <div className="mb-6 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-xs transition-all',
                i < step && 'border-neon-green/60 bg-neon-green/15 text-neon-green',
                i === step && 'border-neon-cyan bg-neon-cyan/15 text-neon-cyan shadow-glow-cyan',
                i > step && 'border-line text-slate-600',
              )}
            >
              {i < step ? <Check size={13} /> : i + 1}
            </span>
            <span className={cn('hidden text-xs sm:block', i === step ? 'text-neon-cyan' : 'text-slate-500')}>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-line" />}
          </div>
        ))}
      </div>

      <GlassCard>
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}>
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label>Name *</Label>
                <Input
                  value={details.name}
                  onChange={(e) => setDetails((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Skyven"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={details.description}
                  onChange={(e) => setDetails((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Primary gaming rig…"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Status</Label>
                  <Select
                    value={details.status}
                    onChange={(e) => setDetails((d) => ({ ...d, status: e.target.value as PCStatus }))}
                  >
                    <option value="active">Active</option>
                    <option value="planned">Planned</option>
                    <option value="retired">Retired</option>
                  </Select>
                </div>
                <div>
                  <Label>Build date</Label>
                  <Input
                    type="date"
                    value={details.build_date}
                    onChange={(e) => setDetails((d) => ({ ...d, build_date: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              {editing && currentParts.length > 0 && (
                <>
                  <Label>Currently installed</Label>
                  <ul className="mb-4 space-y-2">
                    {currentParts.map((part) => (
                      <li key={part.id} className="flex items-center gap-3 rounded-lg border border-line bg-panel-2/50 px-3 py-2 text-sm">
                        <TypeBadge type={part.type} />
                        <span className="flex-1 truncate text-slate-200">{part.brand} {part.model}</span>
                        <Button
                          variant="danger" size="sm"
                          onClick={() => setRemovedParts((prev) => new Set(prev).add(part.id))}
                        >
                          Eject
                        </Button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <Label>Available in inventory — select to install</Label>
              {inventory.isPending ? (
                <PageLoader label="Opening vault" />
              ) : (inventory.data?.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-sm text-slate-500">
                  Inventory is empty. You can add parts later from the Inventory page.
                </p>
              ) : (
                <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
                  {inventory.data!.map((part) => {
                    const checked = selectedParts.has(part.id);
                    return (
                      <li key={part.id}>
                        <button
                          type="button"
                          onClick={() => toggle(part.id)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-all',
                            checked
                              ? 'border-neon-cyan/60 bg-neon-cyan/10 shadow-glow-cyan'
                              : 'border-line bg-panel-2/50 hover:border-neon-cyan/30',
                          )}
                        >
                          <span
                            className={cn(
                              'grid h-4 w-4 shrink-0 place-items-center rounded border',
                              checked ? 'border-neon-cyan bg-neon-cyan text-void' : 'border-slate-600',
                            )}
                          >
                            {checked && <Check size={11} />}
                          </span>
                          <TypeBadge type={part.type} />
                          <span className="flex-1 truncate text-slate-200">{part.brand} {part.model}</span>
                          <ConditionBadge condition={part.condition} />
                          <span className="font-mono text-xs text-neon-cyan">{formatMoney(part.purchase_price)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-400">
                Optional. Stored Fernet-encrypted — plaintext never touches the database.
              </p>
              <div>
                <Label>IP address</Label>
                <Input
                  className="font-mono" placeholder="192.168.1.42"
                  value={network.ip_address}
                  onChange={(e) => { setNetwork((n) => ({ ...n, ip_address: e.target.value })); setTouchNetwork(true); }}
                />
              </div>
              <div>
                <Label>MAC address</Label>
                <Input
                  className="font-mono" placeholder="AA:BB:CC:DD:EE:FF"
                  value={network.mac_address}
                  onChange={(e) => { setNetwork((n) => ({ ...n, mac_address: e.target.value })); setTouchNetwork(true); }}
                />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={network.notes}
                  onChange={(e) => { setNetwork((n) => ({ ...n, notes: e.target.value })); setTouchNetwork(true); }}
                />
              </div>
            </div>
          )}
        </motion.div>

        {error && <p className="mt-4 text-sm text-neon-red">{error}</p>}

        <div className="mt-6 flex justify-between border-t border-line pt-4">
          <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft size={15} /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button variant="solid" disabled={!detailsValid} onClick={() => setStep((s) => s + 1)}>
              Next <ChevronRight size={15} />
            </Button>
          ) : (
            <Button variant="solid" disabled={!detailsValid || submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending ? 'Committing…' : editing ? 'Save changes' : 'Deploy machine'}
            </Button>
          )}
        </div>
      </GlassCard>
    </div>
  );
}
