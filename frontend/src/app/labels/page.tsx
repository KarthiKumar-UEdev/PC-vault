'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';
import { api } from '@/lib/api';

/** Printable A4 sheet of QR stickers — one label per PC. */
export default function LabelsPage() {
  const pcs = useQuery({ queryKey: ['pcs', 'labels'], queryFn: () => api.listPCs() });

  if (pcs.isLoading) return <PageLoader />;
  if (pcs.isError) return <ErrorState error={pcs.error} />;

  return (
    <div className="mx-auto max-w-4xl">
      <header className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/pcs">
            <Button variant="ghost" size="icon" aria-label="Back to PCs">
              <ArrowLeft size={17} />
            </Button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-100">
              QR <span className="neon-text">Labels</span>
            </h1>
            <p className="mt-1 font-mono text-xs text-slate-500">
              // print, cut, stick on the machines
            </p>
          </div>
        </div>
        <Button variant="solid" onClick={() => window.print()}>
          <Printer size={16} /> Print sheet
        </Button>
      </header>

      <div className="label-sheet grid grid-cols-2 gap-4 sm:grid-cols-3">
        {(pcs.data ?? []).map((pc) => (
          <div
            key={pc.id}
            className="label flex flex-col items-center gap-2 rounded-xl bg-white p-4 text-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={api.qrImageUrl(pc.id)}
              alt={`QR code for ${pc.name}`}
              width={140}
              height={140}
              className="h-[140px] w-[140px]"
            />
            <p className="text-sm font-bold leading-tight text-black">{pc.name}</p>
            <p className="font-mono text-[9px] uppercase tracking-widest text-neutral-500">
              pc vault · scan for specs
            </p>
          </div>
        ))}
        {pcs.data?.length === 0 && (
          <p className="no-print col-span-full py-12 text-center text-slate-500">
            No PCs registered yet — nothing to print.
          </p>
        )}
      </div>
    </div>
  );
}
