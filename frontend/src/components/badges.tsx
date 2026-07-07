import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { BuildStatus, PartCondition, PartType, PCStatus } from '@/lib/types';
import { PART_TYPE_LABELS } from '@/lib/types';

const CONDITION_STYLES: Record<PartCondition, string> = {
  new: 'border-neon-cyan/40 text-neon-cyan bg-neon-cyan/10',
  good: 'border-neon-green/40 text-neon-green bg-neon-green/10',
  fair: 'border-neon-amber/40 text-neon-amber bg-neon-amber/10',
  faulty: 'border-neon-red/50 text-neon-red bg-neon-red/10',
  rma: 'border-neon-magenta/40 text-neon-magenta bg-neon-magenta/10',
  retired: 'border-slate-600 text-slate-500 bg-slate-800/40',
};

export function ConditionBadge({ condition }: { condition: PartCondition }) {
  return <Badge className={CONDITION_STYLES[condition]}>{condition}</Badge>;
}

export function TypeBadge({ type }: { type: PartType }) {
  return (
    <Badge className="border-neon-violet/30 bg-neon-violet/10 font-mono text-neon-violet">
      {PART_TYPE_LABELS[type]}
    </Badge>
  );
}

export function StatusDot({ status, className }: { status: PCStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-2.5 w-2.5 rounded-full',
        status === 'active' && 'dot-active',
        status === 'retired' && 'dot-retired',
        status === 'planned' && 'dot-planned',
        className,
      )}
      title={status}
    />
  );
}

const BUILD_STATUS_STYLES: Record<BuildStatus, string> = {
  draft: 'border-line text-slate-400',
  pending: 'border-neon-amber/50 bg-neon-amber/10 text-neon-amber',
  approved: 'border-neon-green/50 bg-neon-green/10 text-neon-green',
  rejected: 'border-neon-red/50 bg-neon-red/10 text-neon-red',
};

export function BuildStatusChip({ status }: { status: BuildStatus }) {
  return (
    <span
      className={cn(
        'rounded-full border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider',
        BUILD_STATUS_STYLES[status],
      )}
    >
      {status}
    </span>
  );
}

export function StatusBadge({ status }: { status: PCStatus }) {
  const styles: Record<PCStatus, string> = {
    active: 'border-neon-green/40 text-neon-green bg-neon-green/10',
    retired: 'border-slate-600 text-slate-400 bg-slate-800/40',
    planned: 'border-neon-amber/40 text-neon-amber bg-neon-amber/10',
  };
  return (
    <Badge className={styles[status]}>
      <StatusDot status={status} className="h-1.5 w-1.5" />
      {status}
    </Badge>
  );
}
