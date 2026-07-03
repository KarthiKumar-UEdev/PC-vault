'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRight, QrCode } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { ConditionBadge, StatusBadge, TypeBadge } from '@/components/badges';
import { Button } from '@/components/ui/button';
import { CardTitle, GlassCard } from '@/components/ui/card';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import { formatDate, formatMoney } from '@/lib/utils';

/** Public landing page a scanned QR code resolves to (?t=TOKEN). */
function QRLandingContent() {
  const params = useSearchParams();
  const token = params.get('t') ?? '';

  const pc = useQuery({
    queryKey: ['pc-qr', token],
    queryFn: () => api.getPCByQR(token),
    enabled: token.length > 0,
    retry: false,
  });

  if (!token) return <ErrorState message="No QR token in the URL." />;
  if (pc.isPending) return <PageLoader label="Resolving tag" />;
  if (pc.isError) return <ErrorState message="Unknown or revoked QR code." />;

  const data = pc.data;

  return (
    <div className="mx-auto max-w-2xl">
      <GlassCard className="border-neon-cyan/30 text-center shadow-glow-cyan">
        <QrCode size={22} className="mx-auto text-neon-cyan" />
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.3em] text-slate-500">
          identity verified
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-slate-100">{data.name}</h1>
        <div className="mt-3 flex items-center justify-center gap-3">
          <StatusBadge status={data.status} />
          <span className="text-xs text-slate-500">built {formatDate(data.build_date)}</span>
        </div>
        {data.description && <p className="mt-3 text-sm text-slate-400">{data.description}</p>}
        <p className="mt-4 font-display text-xl font-bold text-neon-cyan">
          {formatMoney(data.total_value)}
          <span className="ml-2 align-middle font-sans text-xs font-normal text-slate-500">
            total value
          </span>
        </p>
      </GlassCard>

      <GlassCard className="mt-5">
        <CardTitle className="mb-4">Loadout — {data.parts.length} components</CardTitle>
        <ul className="space-y-2">
          {data.parts.map((part) => (
            <li
              key={part.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-panel-2/50 px-3 py-2 text-sm"
            >
              <TypeBadge type={part.type} />
              <span className="min-w-0 flex-1 truncate text-slate-200">
                {part.brand} {part.model}
              </span>
              <ConditionBadge condition={part.condition} />
            </li>
          ))}
        </ul>
      </GlassCard>

      <div className="mt-5 text-center">
        <Link href={`/pcs/view?id=${data.id}`}>
          <Button>
            Open full dossier <ArrowRight size={15} />
          </Button>
        </Link>
      </div>
    </div>
  );
}

export default function QRLandingPage() {
  return (
    <Suspense fallback={<PageLoader label="Resolving tag" />}>
      <QRLandingContent />
    </Suspense>
  );
}
