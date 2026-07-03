import { cn } from '@/lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-lg bg-panel-2/80', className)} />;
}

export function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-line border-t-neon-cyan" />
      <p className="font-mono text-xs uppercase tracking-[0.3em]">{label}…</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="glass mx-auto max-w-md border-neon-red/30 p-8 text-center">
      <p className="font-display text-sm font-bold uppercase tracking-widest text-neon-red">
        Signal lost
      </p>
      <p className="mt-2 text-sm text-slate-400">{message}</p>
      <p className="mt-3 font-mono text-xs text-slate-600">
        Is the API running? Check NEXT_PUBLIC_API_URL.
      </p>
    </div>
  );
}
