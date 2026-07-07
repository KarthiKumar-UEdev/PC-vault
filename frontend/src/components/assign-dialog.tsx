'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Label, Select } from '@/components/ui/input';
import { api } from '@/lib/api';
import type { Part } from '@/lib/types';

/** Hand a device to an employee, or take it back into stock. */
export function AssignDialog({
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

  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.listEmployees(),
    enabled: open,
  });

  const assign = useMutation({
    mutationFn: (employeeId: string | null) => api.assignPart(part.id, employeeId),
    onSuccess: () => {
      queryClient.invalidateQueries();
      onClose();
    },
  });

  const options = (employees ?? []).filter((e) => e.id !== part.employee_id);

  return (
    <Dialog open={open} onClose={onClose} title="Assign to employee">
      <p className="mb-4 text-sm text-slate-300">
        <span className="font-semibold text-neon-cyan">{part.brand} {part.model}</span>
        {' '}is currently{' '}
        <span className="font-mono text-neon-violet">
          {part.employee_name ? `with ${part.employee_name}` : part.pc_name ? `in ${part.pc_name}` : 'in stock'}
        </span>.
      </p>
      {(employees ?? []).length === 0 ? (
        <p className="text-sm text-slate-500">
          No employees yet — add your team on the{' '}
          <Link href="/employees" className="text-neon-cyan hover:underline" onClick={onClose}>
            Team page
          </Link>{' '}
          first.
        </p>
      ) : (
        <>
          <Label htmlFor="assign-target">Hand over to</Label>
          <Select
            id="assign-target"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          >
            <option value="">— select an employee —</option>
            {part.employee_id !== null && <option value="__stock__">↩ Back to stock</option>}
            {options.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}{emp.title ? ` (${emp.title})` : ''}
              </option>
            ))}
          </Select>
        </>
      )}
      {assign.isError && (
        <p className="mt-3 text-sm text-neon-red">{(assign.error as Error).message}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="solid"
          disabled={!target || assign.isPending}
          onClick={() => assign.mutate(target === '__stock__' ? null : target)}
        >
          {assign.isPending ? 'Assigning…' : 'Confirm'}
        </Button>
      </div>
    </Dialog>
  );
}
