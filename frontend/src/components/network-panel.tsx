'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Pencil, Wifi } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CardTitle, GlassCard } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input, Label, Textarea } from '@/components/ui/input';
import { api } from '@/lib/api';
import { maskString } from '@/lib/utils';

function MaskedField({ label, value }: { label: string; value: string | null }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      {value ? (
        <button
          className="group mt-0.5 flex items-center gap-2 font-mono text-sm text-slate-200 transition-colors hover:text-neon-cyan"
          onClick={() => setRevealed((r) => !r)}
          title={revealed ? 'Click to mask' : 'Click to reveal'}
        >
          {revealed ? value : maskString(value)}
          {revealed ? (
            <EyeOff size={13} className="text-slate-500 group-hover:text-neon-cyan" />
          ) : (
            <Eye size={13} className="text-slate-500 group-hover:text-neon-cyan" />
          )}
        </button>
      ) : (
        <p className="mt-0.5 font-mono text-sm text-slate-600">not set</p>
      )}
    </div>
  );
}

export function NetworkPanel({ pcId }: { pcId: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ip_address: '', mac_address: '', notes: '' });

  const net = useQuery({
    queryKey: ['network', pcId],
    queryFn: () => api.getNetwork(pcId),
  });

  const save = useMutation({
    mutationFn: () =>
      api.putNetwork(pcId, {
        ip_address: form.ip_address || null,
        mac_address: form.mac_address || null,
        notes: form.notes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['network', pcId] });
      setEditing(false);
    },
  });

  const openEditor = () => {
    setForm({
      ip_address: net.data?.ip_address ?? '',
      mac_address: net.data?.mac_address ?? '',
      notes: net.data?.notes ?? '',
    });
    setEditing(true);
  };

  return (
    <GlassCard>
      <div className="mb-4 flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Wifi size={13} className="text-neon-cyan" /> Network uplink
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={openEditor}>
          <Pencil size={13} /> Edit
        </Button>
      </div>
      {net.isPending ? (
        <p className="font-mono text-xs text-slate-500">decrypting…</p>
      ) : net.isError ? (
        <p className="text-sm text-neon-red">{(net.error as Error).message}</p>
      ) : (
        <div className="space-y-3">
          <MaskedField label="IP address" value={net.data.ip_address} />
          <MaskedField label="MAC address" value={net.data.mac_address} />
          {net.data.notes && <p className="border-t border-line pt-3 text-sm text-slate-400">{net.data.notes}</p>}
          <p className="font-mono text-[10px] text-slate-600">
            ⛨ encrypted at rest · click values to reveal
          </p>
        </div>
      )}

      <Dialog open={editing} onClose={() => setEditing(false)} title="Network info">
        <div className="space-y-3">
          <div>
            <Label>IP address</Label>
            <Input
              className="font-mono" placeholder="192.168.1.42"
              value={form.ip_address}
              onChange={(e) => setForm((f) => ({ ...f, ip_address: e.target.value }))}
            />
          </div>
          <div>
            <Label>MAC address</Label>
            <Input
              className="font-mono" placeholder="AA:BB:CC:DD:EE:FF"
              value={form.mac_address}
              onChange={(e) => setForm((f) => ({ ...f, mac_address: e.target.value }))}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
        </div>
        {save.isError && <p className="mt-3 text-sm text-neon-red">{(save.error as Error).message}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          <Button variant="solid" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? 'Encrypting…' : 'Save encrypted'}
          </Button>
        </div>
      </Dialog>
    </GlassCard>
  );
}
