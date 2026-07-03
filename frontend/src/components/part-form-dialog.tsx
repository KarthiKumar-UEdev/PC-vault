'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input, Label, Select, Textarea } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { Part, PartCondition, PartInput, PartType } from '@/lib/types';
import { PART_CONDITIONS, PART_TYPE_LABELS, PART_TYPES } from '@/lib/types';

interface FormState {
  type: PartType;
  brand: string;
  model: string;
  serial_number: string;
  condition: PartCondition;
  purchase_date: string;
  purchase_price: string;
  warranty_expiry: string;
  specs: string;
}

const EMPTY: FormState = {
  type: 'cpu', brand: '', model: '', serial_number: '', condition: 'good',
  purchase_date: '', purchase_price: '', warranty_expiry: '', specs: '',
};

function toForm(part: Part): FormState {
  return {
    type: part.type,
    brand: part.brand,
    model: part.model,
    serial_number: part.serial_number ?? '',
    condition: part.condition,
    purchase_date: part.purchase_date ?? '',
    purchase_price: part.purchase_price ?? '',
    warranty_expiry: part.warranty_expiry ?? '',
    specs: part.specs ? JSON.stringify(part.specs, null, 2) : '',
  };
}

/** Create or edit a part. Pass `part` to edit, omit to create. */
export function PartFormDialog({
  open,
  onClose,
  part,
  defaultPcId = null,
}: {
  open: boolean;
  onClose: () => void;
  part?: Part;
  defaultPcId?: string | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [specsError, setSpecsError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(part ? toForm(part) : EMPTY);
      setSpecsError(null);
    }
  }, [open, part]);

  const save = useMutation({
    mutationFn: (payload: PartInput) =>
      part ? api.updatePart(part.id, payload) : api.createPart(payload),
    onSuccess: () => {
      queryClient.invalidateQueries();
      onClose();
    },
  });

  const set = (key: keyof FormState) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = () => {
    let specs: Record<string, unknown> | null = null;
    if (form.specs.trim()) {
      try {
        specs = JSON.parse(form.specs) as Record<string, unknown>;
      } catch {
        setSpecsError('Specs must be valid JSON (e.g. {"cores": 8}).');
        return;
      }
    }
    const payload: PartInput = {
      type: form.type,
      brand: form.brand.trim(),
      model: form.model.trim(),
      serial_number: form.serial_number.trim() || null,
      condition: form.condition,
      purchase_date: form.purchase_date || null,
      purchase_price: form.purchase_price || null,
      warranty_expiry: form.warranty_expiry || null,
      specs,
    };
    if (!part) payload.pc_id = defaultPcId;
    save.mutate(payload);
  };

  const valid = form.brand.trim().length > 0 && form.model.trim().length > 0;

  return (
    <Dialog open={open} onClose={onClose} title={part ? 'Edit part' : 'Register part'}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Type</Label>
          <Select value={form.type} onChange={set('type')}>
            {PART_TYPES.map((t) => (
              <option key={t} value={t}>{PART_TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Condition</Label>
          <Select value={form.condition} onChange={set('condition')}>
            {PART_CONDITIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Brand *</Label>
          <Input value={form.brand} onChange={set('brand')} placeholder="AMD" />
        </div>
        <div>
          <Label>Model *</Label>
          <Input value={form.model} onChange={set('model')} placeholder="Ryzen 7 7800X3D" />
        </div>
        <div className="col-span-2">
          <Label>Serial number</Label>
          <Input value={form.serial_number} onChange={set('serial_number')} className="font-mono" />
        </div>
        <div>
          <Label>Purchase date</Label>
          <Input type="date" value={form.purchase_date} onChange={set('purchase_date')} />
        </div>
        <div>
          <Label>Price (USD)</Label>
          <Input
            type="number" min="0" step="0.01"
            value={form.purchase_price} onChange={set('purchase_price')} placeholder="449.00"
          />
        </div>
        <div className="col-span-2">
          <Label>Warranty expiry</Label>
          <Input type="date" value={form.warranty_expiry} onChange={set('warranty_expiry')} />
        </div>
        <div className="col-span-2">
          <Label>Specs (JSON)</Label>
          <Textarea
            value={form.specs} onChange={set('specs')}
            className="font-mono text-xs" placeholder='{"cores": 8, "boost_ghz": 5.0}'
          />
          {specsError && <p className="mt-1 text-xs text-neon-red">{specsError}</p>}
        </div>
      </div>
      {save.isError && (
        <p className="mt-3 text-sm text-neon-red">{(save.error as Error).message}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="solid" disabled={!valid || save.isPending} onClick={submit}>
          {save.isPending ? 'Saving…' : part ? 'Save changes' : 'Register'}
        </Button>
      </div>
    </Dialog>
  );
}
