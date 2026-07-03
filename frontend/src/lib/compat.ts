import { findCatalogEntry, type CatalogSpecs } from './catalog';
import type { BuildItem, PartType } from './types';

/** PCPartPicker-style compatibility + wattage engine.
 *
 *  Works entirely client-side: owned parts contribute their `specs` JSON,
 *  wishlist items contribute the specs of the catalog entry they were
 *  picked from. Items without usable specs are simply skipped — checks are
 *  advisory, never blocking.
 */

export interface CompatIssue {
  severity: 'error' | 'warning';
  message: string;
}

interface Resolved {
  type: PartType;
  label: string;
  specs: CatalogSpecs;
}

function normalizeSpecs(raw: Record<string, unknown> | null | undefined): CatalogSpecs {
  if (!raw) return {};
  const out: CatalogSpecs = {};
  if (typeof raw.socket === 'string') out.socket = raw.socket.toUpperCase().replace(/\s/g, '');
  const mem = typeof raw.mem_type === 'string' ? raw.mem_type
    : typeof raw.speed === 'string' ? raw.speed // seed data stores "DDR5-6000"
    : undefined;
  if (mem) {
    const m = mem.toUpperCase().match(/DDR[45]/);
    if (m) out.mem_type = m[0] as 'DDR4' | 'DDR5';
  }
  for (const key of ['tdp_w', 'watts', 'capacity_gb'] as const) {
    const v = raw[key];
    if (typeof v === 'number') out[key] = v;
    else if (typeof v === 'string' && !Number.isNaN(parseFloat(v))) out[key] = parseFloat(v);
  }
  // seed data variants
  if (out.watts === undefined && typeof raw.wattage === 'number') out.watts = raw.wattage;
  if (typeof raw.form_factor === 'string') out.form_factor = raw.form_factor;
  return out;
}

export function resolveItem(item: BuildItem): Resolved | null {
  if (item.part) {
    return {
      type: item.part.type,
      label: `${item.part.brand} ${item.part.model}`,
      specs: normalizeSpecs(item.part.specs),
    };
  }
  if (item.external_type && item.external_name) {
    const entry = findCatalogEntry(item.external_type, item.external_name);
    return {
      type: item.external_type,
      label: item.external_name,
      specs: normalizeSpecs(entry?.specs as Record<string, unknown> | undefined),
    };
  }
  return null;
}

const BASE_LOAD_W = 90; // mobo + drives + fans headroom
const PSU_HEADROOM = 1.25; // recommend 25% over estimated draw

export interface CompatReport {
  issues: CompatIssue[];
  estimatedWatts: number | null;
  recommendedPsuWatts: number | null;
  psuWatts: number | null;
}

export function checkCompatibility(items: BuildItem[]): CompatReport {
  const resolved = items.map(resolveItem).filter((r): r is Resolved => r !== null);
  const byType = (t: PartType) => resolved.filter((r) => r.type === t);
  const issues: CompatIssue[] = [];

  const cpus = byType('cpu');
  const mobos = byType('mobo');
  const rams = byType('ram');
  const psus = byType('psu');
  const gpus = byType('gpu');

  // ── socket ──────────────────────────────────────────────────────────
  for (const cpu of cpus) {
    for (const mobo of mobos) {
      if (cpu.specs.socket && mobo.specs.socket && cpu.specs.socket !== mobo.specs.socket) {
        issues.push({
          severity: 'error',
          message: `${cpu.label} (${cpu.specs.socket}) does not fit ${mobo.label} (${mobo.specs.socket}).`,
        });
      }
    }
  }

  // ── memory generation ───────────────────────────────────────────────
  for (const ram of rams) {
    for (const mobo of mobos) {
      if (ram.specs.mem_type && mobo.specs.mem_type && ram.specs.mem_type !== mobo.specs.mem_type) {
        issues.push({
          severity: 'error',
          message: `${ram.label} is ${ram.specs.mem_type} but ${mobo.label} takes ${mobo.specs.mem_type}.`,
        });
      }
    }
  }

  // ── duplicate single-slot components ────────────────────────────────
  for (const t of ['cpu', 'mobo', 'psu', 'case'] as PartType[]) {
    if (byType(t).length > 1) {
      issues.push({
        severity: 'warning',
        message: `Build contains ${byType(t).length}× ${t.toUpperCase()} — one machine takes one.`,
      });
    }
  }

  // ── wattage estimate ────────────────────────────────────────────────
  const draws = [...cpus, ...gpus].map((r) => r.specs.tdp_w).filter((w): w is number => !!w);
  const estimatedWatts =
    draws.length > 0 ? Math.round(draws.reduce((a, b) => a + b, 0) + BASE_LOAD_W) : null;
  const recommendedPsuWatts =
    estimatedWatts !== null ? Math.ceil((estimatedWatts * PSU_HEADROOM) / 50) * 50 : null;
  const psuWatts = psus.map((p) => p.specs.watts).find((w): w is number => !!w) ?? null;

  if (estimatedWatts !== null && psuWatts !== null) {
    if (psuWatts < estimatedWatts) {
      issues.push({
        severity: 'error',
        message: `PSU is ${psuWatts}W but the build draws ~${estimatedWatts}W under load.`,
      });
    } else if (psuWatts < recommendedPsuWatts!) {
      issues.push({
        severity: 'warning',
        message: `PSU is ${psuWatts}W; ~${recommendedPsuWatts}W recommended for 25% headroom.`,
      });
    }
  }

  return { issues, estimatedWatts, recommendedPsuWatts, psuWatts };
}
