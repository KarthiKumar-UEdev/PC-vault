'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Cloud, Globe, Monitor, Network, Router, Wifi } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { ConditionBadge, TypeBadge } from '@/components/badges';
import { CardTitle, GlassCard } from '@/components/ui/card';
import { ErrorState, PageLoader } from '@/components/ui/skeleton';
import { api } from '@/lib/api';
import type { Part, PC } from '@/lib/types';
import { formatMoney } from '@/lib/utils';

/* ── auto-generated topology schematic ─────────────────────────────────── */

interface Node {
  id: string;
  label: string;
  sub?: string;
  kind: 'internet' | 'router' | 'switch' | 'ap' | 'pc';
  x: number;
  y: number;
}

const KIND_STYLE: Record<Node['kind'], { stroke: string; fill: string; text: string }> = {
  internet: { stroke: '#38bdf8', fill: 'rgba(56,189,248,0.08)', text: '#38bdf8' },
  router: { stroke: '#22d3ee', fill: 'rgba(34,211,238,0.08)', text: '#22d3ee' },
  switch: { stroke: '#a78bfa', fill: 'rgba(167,139,250,0.08)', text: '#a78bfa' },
  ap: { stroke: '#34d399', fill: 'rgba(52,211,153,0.08)', text: '#34d399' },
  pc: { stroke: '#64748b', fill: 'rgba(100,116,139,0.08)', text: '#94a3b8' },
};

const W = 900;
const NODE_W = 118;
const NODE_H = 44;

function spread(count: number, y: number): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => ({
    x: (W / (count + 1)) * (i + 1) - NODE_W / 2,
    y,
  }));
}

function TopologyMap({ routers, switches, aps, pcs }: {
  routers: Part[];
  switches: Part[];
  aps: Part[];
  pcs: PC[];
}) {
  const { nodes, links, height } = useMemo(() => {
    const nodes: Node[] = [];
    const links: { from: string; to: string }[] = [];

    const rows: { y: number }[] = [];
    let y = 24;
    const addRow = () => { rows.push({ y }); y += 108; };

    addRow(); // internet
    nodes.push({ id: '__net__', label: 'Internet', kind: 'internet', x: W / 2 - NODE_W / 2, y: rows[0].y });

    addRow(); // routers
    const routerRow = routers.length > 0 ? routers : [];
    spread(Math.max(routerRow.length, 1), rows[1].y).forEach((pos, i) => {
      const r = routerRow[i];
      const id = r ? r.id : '__no-router__';
      nodes.push({
        id,
        label: r ? r.model : 'no router yet',
        sub: r?.brand,
        kind: 'router',
        ...pos,
      });
      links.push({ from: '__net__', to: id });
    });
    const routerIds = nodes.filter((n) => n.kind === 'router').map((n) => n.id);

    let parentIds = routerIds;
    if (switches.length > 0) {
      addRow();
      spread(switches.length, rows[rows.length - 1].y).forEach((pos, i) => {
        const s = switches[i];
        nodes.push({ id: s.id, label: s.model, sub: s.brand, kind: 'switch', ...pos });
        links.push({ from: routerIds[i % routerIds.length], to: s.id });
      });
      parentIds = switches.map((s) => s.id);
    }

    const leaves: Node[] = [];
    aps.forEach((a) => leaves.push({ id: a.id, label: a.model, sub: a.brand, kind: 'ap', x: 0, y: 0 }));
    pcs.forEach((pc) => leaves.push({
      id: `pc-${pc.id}`,
      label: pc.name,
      sub: pc.employee_name ?? undefined,
      kind: 'pc',
      x: 0,
      y: 0,
    }));
    if (leaves.length > 0) {
      // wrap leaves into rows of 6 so big fleets stay readable
      const perRow = 6;
      for (let start = 0; start < leaves.length; start += perRow) {
        addRow();
        const slice = leaves.slice(start, start + perRow);
        spread(slice.length, rows[rows.length - 1].y).forEach((pos, i) => {
          const leaf = slice[i];
          leaf.x = pos.x;
          leaf.y = pos.y;
          nodes.push(leaf);
          links.push({ from: parentIds[(start + i) % parentIds.length], to: leaf.id });
        });
      }
    }

    return { nodes, links, height: y - 40 };
  }, [routers, switches, aps, pcs]);

  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${height}`} className="min-w-[640px] w-full">
        {links.map((link, i) => {
          const a = byId.get(link.from);
          const b = byId.get(link.to);
          if (!a || !b) return null;
          const x1 = a.x + NODE_W / 2;
          const y1 = a.y + NODE_H;
          const x2 = b.x + NODE_W / 2;
          const y2 = b.y;
          return (
            <path
              key={i}
              d={`M ${x1} ${y1} C ${x1} ${y1 + 36}, ${x2} ${y2 - 36}, ${x2} ${y2}`}
              fill="none"
              stroke="rgba(148,163,184,0.35)"
              strokeWidth="1.2"
            />
          );
        })}
        {nodes.map((node) => {
          const style = KIND_STYLE[node.kind];
          return (
            <g key={node.id}>
              <rect
                x={node.x}
                y={node.y}
                width={NODE_W}
                height={NODE_H}
                rx="9"
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth="1.2"
              />
              <text
                x={node.x + NODE_W / 2}
                y={node.y + (node.sub ? 19 : 26)}
                textAnchor="middle"
                fill={style.text}
                fontSize="11"
                fontFamily="monospace"
              >
                {node.label.length > 17 ? `${node.label.slice(0, 16)}…` : node.label}
              </text>
              {node.sub && (
                <text
                  x={node.x + NODE_W / 2}
                  y={node.y + 33}
                  textAnchor="middle"
                  fill="rgba(148,163,184,0.8)"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {node.sub.length > 20 ? `${node.sub.slice(0, 19)}…` : node.sub}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── page ──────────────────────────────────────────────────────────────── */

export default function NetworkPage() {
  const parts = useQuery({ queryKey: ['parts', 'all'], queryFn: () => api.listParts() });
  const pcs = useQuery({ queryKey: ['pcs'], queryFn: () => api.listPCs() });

  if (parts.isPending || pcs.isPending) return <PageLoader label="Mapping the network" />;
  if (parts.isError) return <ErrorState message={(parts.error as Error).message} />;

  const gear = (parts.data ?? []).filter((p) =>
    p.type === 'router' || p.type === 'switch' || p.type === 'ap',
  );
  const routers = gear.filter((p) => p.type === 'router');
  const switches = gear.filter((p) => p.type === 'switch');
  const aps = gear.filter((p) => p.type === 'ap');
  const activePcs = (pcs.data ?? []).filter((pc) => pc.status === 'active');

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-slate-100">
          Office <span className="neon-text">Network</span>
        </h1>
        <p className="mt-1 font-mono text-xs text-slate-500">
          // routers, switches &amp; how it all connects
        </p>
      </header>

      {/* quick stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Routers', value: routers.length, icon: <Router size={16} />, color: 'text-neon-cyan' },
          { label: 'Switches', value: switches.length, icon: <Network size={16} />, color: 'text-neon-violet' },
          { label: 'Access points', value: aps.length, icon: <Wifi size={16} />, color: 'text-neon-green' },
          { label: 'Active PCs', value: activePcs.length, icon: <Monitor size={16} />, color: 'text-slate-300' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <GlassCard className="flex items-center gap-3 py-3">
              <span className={s.color}>{s.icon}</span>
              <div>
                <p className="font-display text-xl font-bold text-slate-100">{s.value}</p>
                <p className="text-[10px] uppercase tracking-[0.15em] text-slate-500">{s.label}</p>
              </div>
            </GlassCard>
          </motion.div>
        ))}
      </div>

      {/* topology */}
      <GlassCard className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <Globe size={13} /> Topology
          </CardTitle>
          <span className="font-mono text-[10px] text-slate-600">
            auto-generated schematic — a manual designer / import is on the roadmap
          </span>
        </div>
        {gear.length === 0 && activePcs.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            <Cloud size={22} className="mx-auto mb-3 text-neon-cyan" />
            <p className="text-sm">
              Register routers, switches or access points in the{' '}
              <Link href="/inventory" className="text-neon-cyan hover:underline">Asset Vault</Link>{' '}
              and they show up here.
            </p>
          </div>
        ) : (
          <TopologyMap routers={routers} switches={switches} aps={aps} pcs={activePcs} />
        )}
      </GlassCard>

      {/* gear list */}
      <CardTitle className="mb-4">Network gear</CardTitle>
      {gear.length === 0 ? (
        <div className="glass p-10 text-center text-sm text-slate-500">
          No network gear registered yet — add routers and switches from the Asset Vault.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {gear.map((part, i) => (
            <motion.div
              key={part.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.4) }}
            >
              <GlassCard className="glass-hover">
                <div className="flex items-start justify-between gap-2">
                  <TypeBadge type={part.type} />
                  <ConditionBadge condition={part.condition} />
                </div>
                <Link href={`/parts/view?id=${part.id}`} className="group mt-3 block">
                  <h3 className="font-display text-base font-bold text-slate-100 transition-colors group-hover:text-neon-cyan">
                    {part.brand}
                  </h3>
                  <p className="text-sm text-slate-300">{part.model}</p>
                  {part.serial_number && (
                    <p className="mt-1 truncate font-mono text-[11px] text-slate-500">
                      SN {part.serial_number}
                    </p>
                  )}
                </Link>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <span className="font-mono text-[11px] text-slate-500">
                    {part.type === 'router' ? 'gateway' : part.type === 'switch' ? 'distribution' : 'wireless'}
                  </span>
                  <span className="font-mono text-sm text-neon-cyan">{formatMoney(part.purchase_price)}</span>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
