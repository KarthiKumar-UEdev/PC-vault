'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Boxes, Laptop, Mail, Monitor, Pencil, Plus, Trash2, UserRound, UsersRound,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { TypeBadge } from '@/components/badges';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { Employee, EmployeeInput } from '@/lib/types';
import { useIsAdmin } from '@/lib/use-role';

const EMPTY: EmployeeInput = { name: '', title: '', email: '', department: '' };

/* ── create / edit dialog ──────────────────────────────────────────────── */

function EmployeeFormDialog({
  open,
  onClose,
  employee,
}: {
  open: boolean;
  onClose: () => void;
  employee?: Employee;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EmployeeInput>(
    employee
      ? {
          name: employee.name,
          title: employee.title ?? '',
          email: employee.email ?? '',
          department: employee.department ?? '',
        }
      : EMPTY,
  );

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name.trim(),
        title: form.title?.trim() || null,
        email: form.email?.trim() || null,
        department: form.department?.trim() || null,
      };
      return employee
        ? api.updateEmployee(employee.id, payload)
        : api.createEmployee(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      onClose();
    },
  });

  const set = (key: keyof EmployeeInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <Dialog open={open} onClose={onClose} title={employee ? 'Edit employee' : 'Add employee'}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label>Name *</Label>
          <Input value={form.name} onChange={set('name')} placeholder="Karthi Kumar" autoFocus />
        </div>
        <div>
          <Label>Title</Label>
          <Input value={form.title ?? ''} onChange={set('title')} placeholder="Developer" />
        </div>
        <div>
          <Label>Department</Label>
          <Input value={form.department ?? ''} onChange={set('department')} placeholder="Engineering" />
        </div>
        <div className="col-span-2">
          <Label>Email</Label>
          <Input value={form.email ?? ''} onChange={set('email')} placeholder="name@company.com" />
        </div>
      </div>
      {save.isError && (
        <p className="mt-3 text-sm text-neon-red">{(save.error as Error).message}</p>
      )}
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          variant="solid"
          disabled={!form.name.trim() || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? 'Saving…' : employee ? 'Save changes' : 'Add employee'}
        </Button>
      </div>
    </Dialog>
  );
}

/* ── one employee card with their gear ─────────────────────────────────── */

function EmployeeCard({
  employee,
  isAdmin,
  onEdit,
}: {
  employee: Employee;
  isAdmin: boolean;
  onEdit: () => void;
}) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ['employee', employee.id],
    queryFn: () => api.getEmployee(employee.id),
  });

  const del = useMutation({
    mutationFn: () => api.deleteEmployee(employee.id),
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <GlassCard className="glass-hover flex h-full flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-neon-green/40 bg-neon-green/10 text-neon-green">
            <UserRound size={17} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-bold text-slate-100">
              {employee.name}
            </h3>
            <p className="truncate text-xs text-slate-400">
              {[employee.title, employee.department].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        </div>
        {isAdmin && (
          <div className="flex shrink-0 gap-1">
            <button
              onClick={onEdit}
              className="text-slate-600 transition-colors hover:text-neon-cyan"
              aria-label={`Edit ${employee.name}`}
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => {
                if (confirm(`Remove "${employee.name}"? Their gear goes back to stock.`))
                  del.mutate();
              }}
              className="text-slate-600 transition-colors hover:text-neon-red"
              aria-label={`Delete ${employee.name}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {employee.email && (
        <p className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
          <Mail size={11} /> {employee.email}
        </p>
      )}

      {/* assigned gear */}
      <div className="mt-4 flex-1 space-y-1.5 border-t border-line pt-3">
        {detail.isPending ? (
          <p className="font-mono text-[11px] text-slate-600">loading gear…</p>
        ) : (detail.data?.pcs.length ?? 0) === 0 && (detail.data?.parts.length ?? 0) === 0 ? (
          <p className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600">
            <Boxes size={11} /> no gear assigned
          </p>
        ) : (
          <>
            {detail.data!.pcs.map((pc) => (
              <Link
                key={pc.id}
                href={`/pcs/view?id=${pc.id}`}
                className="flex items-center gap-2 rounded-lg border border-line bg-panel-2/50 px-2.5 py-1.5 text-xs text-slate-200 transition-all hover:border-neon-cyan/40"
              >
                <Monitor size={12} className="shrink-0 text-neon-cyan" />
                <span className="min-w-0 flex-1 truncate">{pc.name}</span>
                <span className="font-mono text-[10px] uppercase text-slate-500">PC</span>
              </Link>
            ))}
            {detail.data!.parts.map((part) => (
              <Link
                key={part.id}
                href={`/parts/view?id=${part.id}`}
                className="flex items-center gap-2 rounded-lg border border-line bg-panel-2/50 px-2.5 py-1.5 text-xs text-slate-200 transition-all hover:border-neon-cyan/40"
              >
                <Laptop size={12} className="shrink-0 text-neon-violet" />
                <span className="min-w-0 flex-1 truncate">{part.brand} {part.model}</span>
                <TypeBadge type={part.type} />
              </Link>
            ))}
          </>
        )}
      </div>

      <p className="mt-3 border-t border-line pt-2 font-mono text-[10px] text-slate-600">
        {employee.pc_count} PC{employee.pc_count === 1 ? '' : 's'} · {employee.device_count} device
        {employee.device_count === 1 ? '' : 's'}
      </p>
    </GlassCard>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */

export default function EmployeesPage() {
  const isAdmin = useIsAdmin();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const employees = useQuery({
    queryKey: ['employees', search],
    queryFn: () => api.listEmployees(search || undefined),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">
            The <span className="neon-text">Team</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">// who uses what</p>
        </div>
        {isAdmin && (
          <Button variant="solid" onClick={() => setCreating(true)}>
            <Plus size={16} /> Add employee
          </Button>
        )}
      </header>

      <div className="glass mb-6 flex flex-wrap items-center gap-3 p-3">
        <UsersRound size={16} className="ml-1 text-neon-green" />
        <Input
          className="w-64"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="ml-auto font-mono text-xs text-slate-500">
          {employees.data?.length ?? '—'} people
        </span>
      </div>

      {employees.isPending ? (
        <PageLoader label="Loading the roster" />
      ) : employees.isError ? (
        <ErrorState message={(employees.error as Error).message} />
      ) : employees.data.length === 0 ? (
        <div className="glass p-12 text-center text-slate-500">
          <UsersRound size={22} className="mx-auto mb-3 text-neon-green" />
          <p className="font-display text-sm uppercase tracking-widest">No employees yet</p>
          <p className="mt-2 text-sm">
            {isAdmin
              ? 'Add your team, then assign laptops, headsets and PCs to them.'
              : 'The admin has not added anyone yet.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {employees.data.map((emp, i) => (
            <motion.div
              key={emp.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.5) }}
            >
              <EmployeeCard
                employee={emp}
                isAdmin={isAdmin}
                onEdit={() => setEditing(emp)}
              />
            </motion.div>
          ))}
        </div>
      )}

      {creating && <EmployeeFormDialog open onClose={() => setCreating(false)} />}
      {editing && (
        <EmployeeFormDialog open employee={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
