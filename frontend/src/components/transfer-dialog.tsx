'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Label, Select } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { Part } from '@/lib/types';

/** Move a part to a PC (or back to inventory), creating a transfer log. */
export function TransferDialog({
  part,
  open,
  onClose,
}: {
  part: Part;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<string>('');

  const { data: pcs } = useQuery({
    queryKey: ['pcs'],
    queryFn: () => api.listPCs(),
    enabled: open,
  });

  const transfer = useMutation({
    mutationFn: (toPcId: string | null) => api.transferPart(part.id, toPcId),
    onSuccess: () => {
      queryClient.invalidateQueries();
      onClose();
    },
  });

  const options = (pcs ?? []).filter((pc) => pc.id !== part.pc_id);

  return (
    <Dialog open={open} onClose={onClose} title="Transfer part">
      <p className="mb-4 text-sm text-slate-300">
        <span className="font-semibold text-neon-cyan">{part.brand} {part.model}</span>
        {' '}is currently in{' '}
        <span className="font-mono text-neon-violet">{part.pc_name ?? 'inventory'}</span>.
      </p>
      <Label htmlFor="transfer-target">Destination</Label>
      <Select
        id="transfer-target"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      >
        <option value="">— select a PC —</option>
        {part.pc_id !== null && <option value="__inventory__">↩ Back to inventory</option>}
        {options.map((pc) => (
          <option key={pc.id} value={pc.id}>
            {pc.name} ({pc.status})
          </option>
        ))}
      </Select>
      {transfer.isError && (
        <p className="mt-3 text-sm text-neon-red">{(transfer.error as Error).message}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="solid"
          disabled={!target || transfer.isPending}
          onClick={() => transfer.mutate(target === '__inventory__' ? null : target)}
        >
          {transfer.isPending ? 'Moving…' : 'Confirm transfer'}
        </Button>
      </div>
    </Dialog>
  );
}
