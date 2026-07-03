'use client';

import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { PCCard } from '@/components/pc-card';
import { Button } from '@/components/ui/button';
import { Input, Select } from '@/components/ui/input';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

export default function PCsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState<'name' | 'build_date'>('name');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const pcs = useQuery({
    queryKey: ['pcs', { search, status, sort, order }],
    queryFn: () => api.listPCs({ search: search || undefined, status: status || undefined, sort, order }),
  });

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-100">
            Fleet <span className="neon-text">Registry</span>
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">// all registered machines</p>
        </div>
        <Link href="/pcs/new">
          <Button variant="solid">
            <Plus size={16} /> New PC
          </Button>
        </Link>
      </header>

      {/* search + filter bar */}
      <div className="glass mb-6 flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-48 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <Input
            className="pl-9"
            placeholder="Search name or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select className="w-32" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="retired">Retired</option>
          <option value="planned">Planned</option>
        </Select>
        <Select
          className="w-40"
          value={`${sort}:${order}`}
          onChange={(e) => {
            const [s, o] = e.target.value.split(':') as ['name' | 'build_date', 'asc' | 'desc'];
            setSort(s);
            setOrder(o);
          }}
        >
          <option value="name:asc">Name A→Z</option>
          <option value="name:desc">Name Z→A</option>
          <option value="build_date:desc">Newest build</option>
          <option value="build_date:asc">Oldest build</option>
        </Select>
      </div>

      {pcs.isPending ? (
        <PageLoader label="Scanning fleet" />
      ) : pcs.isError ? (
        <ErrorState message={(pcs.error as Error).message} />
      ) : pcs.data.length === 0 ? (
        <div className="glass p-12 text-center text-slate-500">
          <p className="font-display text-sm uppercase tracking-widest">No machines found</p>
          <p className="mt-2 text-sm">Register your first PC to bring the vault online.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pcs.data.map((pc, i) => (
            <PCCard key={pc.id} pc={pc} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
