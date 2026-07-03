'use client';

import { daysUntil } from '@/lib/utils';

/** SVG countdown ring: full ring = 365 days of warranty left. */
export function WarrantyRing({ expiry, size = 120 }: { expiry: string | null; size?: number }) {
  const left = daysUntil(expiry);
  const radius = size / 2 - 8;
  const circumference = 2 * Math.PI * radius;

  let fraction = 0;
  let color = '#64748b';
  let label = 'No data';
  if (left !== null) {
    if (left < 0) {
      fraction = 0;
      color = '#fb7185';
      label = 'Expired';
    } else {
      fraction = Math.min(1, left / 365);
      color = left <= 30 ? '#fb7185' : left <= 90 ? '#fbbf24' : '#34d399';
      label = `${left}d left`;
    }
  }

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(148,163,253,0.12)" strokeWidth={6}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          style={{
            filter: `drop-shadow(0 0 6px ${color})`,
            transition: 'stroke-dashoffset 1s ease-out',
          }}
        />
      </svg>
      <div className="absolute text-center">
        <p className="font-display text-sm font-bold" style={{ color }}>
          {label}
        </p>
        {left !== null && left >= 0 && (
          <p className="mt-0.5 font-mono text-[10px] text-slate-500">warranty</p>
        )}
      </div>
    </div>
  );
}
