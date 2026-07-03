import { cn } from '@/lib/utils';

export function GlassCard({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('glass p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <h3 className={cn('font-display text-xs font-bold uppercase tracking-[0.2em] text-slate-400', className)}>
      {children}
    </h3>
  );
}
