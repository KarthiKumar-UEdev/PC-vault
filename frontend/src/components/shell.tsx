'use client';

import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Boxes,
  ClipboardCheck,
  LayoutDashboard,
  LogOut,
  Monitor,
  Network,
  ScanLine,
  Settings,
  Terminal,
  UsersRound,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { clearToken, getRole, getToken, getUsername, isPublicPath, type Role } from '@/lib/auth';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pcs', label: 'PCs', icon: Monitor },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/employees', label: 'Team', icon: UsersRound },
  { href: '/network', label: 'Network', icon: Network },
  { href: '/planner', label: 'Planner', icon: Wrench },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/scan', label: 'Scan', icon: ScanLine },
];
// role-specific item slots in after Planner
const ROLE_ITEM_AT = 6;

const APPROVALS = { href: '/approvals', label: 'Approvals', icon: ClipboardCheck };
const OPS = { href: '/admin', label: 'Ops', icon: Terminal };

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // read after mount — localStorage isn't available during prerender
  const [hasSession, setHasSession] = useState(false);
  const [role, setRole] = useState<Role | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  useEffect(() => {
    setHasSession(!!getToken());
    setRole(getToken() ? getRole() : null);
    setUsername(getUsername());
  }, [pathname]);

  // no session on a server that requires one → straight to the login page
  const authStatus = useQuery({ queryKey: ['auth-status'], queryFn: api.authStatus });
  useEffect(() => {
    if (!authStatus.data?.auth_required) return;
    if (!getToken() && !isPublicPath(pathname)) router.replace('/login/');
  }, [authStatus.data, pathname, router]);

  const isManager = role === 'manager';
  const isAdmin = role === 'admin';

  // live badge: manager sees builds awaiting sign-off, admin sees builds
  // needing a response (rejected) or ready to convert (approved)
  const builds = useQuery({
    queryKey: ['builds'],
    queryFn: api.listBuilds,
    enabled: role !== null,
    refetchInterval: 30_000,
  });
  const pendingCount = isManager
    ? (builds.data ?? []).filter((b) => b.status === 'pending').length
    : isAdmin
      ? (builds.data ?? []).filter((b) => b.status === 'rejected' || b.status === 'approved').length
      : 0;
  const badgeHref = isManager ? '/approvals' : '/admin';

  const nav = isManager
    ? [...NAV.slice(0, ROLE_ITEM_AT), APPROVALS, ...NAV.slice(ROLE_ITEM_AT)]
    : isAdmin
      ? [...NAV.slice(0, ROLE_ITEM_AT), OPS, ...NAV.slice(ROLE_ITEM_AT)]
      : NAV;

  const logout = () => {
    clearToken();
    setHasSession(false);
    setRole(null);
    router.push('/login/');
  };

  return (
    <div className="bg-grid min-h-screen">
      {/* ── desktop sidebar ─────────────────────────────────────────── */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col border-r border-line bg-panel/40 backdrop-blur-lg md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-5 py-6">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-neon-cyan/30 to-neon-violet/30 border border-neon-cyan/40 shadow-glow-cyan">
            <Monitor className="h-4.5 w-4.5 text-neon-cyan" size={18} />
          </span>
          <span className="font-display text-lg font-bold tracking-widest neon-text">
            PC VAULT
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 px-3 pt-2">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            const badge = href === badgeHref && pendingCount > 0;
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                  active
                    ? 'bg-neon-cyan/10 text-neon-cyan'
                    : 'text-slate-400 hover:bg-panel-2 hover:text-slate-200',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-glow"
                    className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-neon-cyan shadow-glow-cyan"
                  />
                )}
                <Icon size={17} className={cn(active && 'drop-shadow-[0_0_6px_rgba(34,211,238,0.8)]')} />
                {label}
                {badge && (
                  <span className="ml-auto rounded-full border border-neon-amber/50 bg-neon-amber/10 px-1.5 font-mono text-[10px] text-neon-amber">
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line px-3 pb-4 pt-3">
          {hasSession && (
            <Link
              href="/settings"
              className={cn(
                'mb-2 flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-all',
                isActive(pathname, '/settings')
                  ? 'bg-neon-cyan/10 text-neon-cyan'
                  : 'text-slate-400 hover:bg-panel-2 hover:text-slate-200',
              )}
            >
              <Settings size={15} />
              <span className="min-w-0 flex-1 truncate">{username ?? 'Settings'}</span>
              <span
                className={cn(
                  'rounded-full border px-1.5 font-mono text-[9px] uppercase',
                  isManager
                    ? 'border-neon-violet/40 text-neon-violet'
                    : 'border-neon-green/40 text-neon-green',
                )}
              >
                {role}
              </span>
            </Link>
          )}
          <div className="flex items-center justify-between px-2">
            <p className="font-mono text-[10px] text-slate-600">
              v1.0 //{' '}
              {isManager ? (
                <span className="text-neon-violet">manager mode</span>
              ) : (
                'vault online'
              )}
            </p>
            {hasSession && (
              <button
                onClick={logout}
                title="Log out"
                className="text-slate-600 transition-colors hover:text-neon-red"
              >
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* ── mobile top bar ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-void/80 px-4 py-3 backdrop-blur-lg md:hidden">
        <span className="w-8" aria-hidden />
        <span className="font-display text-base font-bold tracking-widest neon-text">
          PC VAULT
        </span>
        {hasSession ? (
          <Link
            href="/settings"
            aria-label="Settings"
            className={cn(
              'grid h-8 w-8 place-items-center rounded-lg transition-colors',
              isActive(pathname, '/settings') ? 'text-neon-cyan' : 'text-slate-400',
            )}
          >
            <Settings size={18} />
          </Link>
        ) : (
          <span className="w-8" aria-hidden />
        )}
      </header>

      {/* ── page content with transition ────────────────────────────── */}
      <main className="px-4 pb-24 pt-6 md:ml-56 md:px-8 md:pb-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ── mobile bottom nav ───────────────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-between gap-1 overflow-x-auto border-t border-line bg-void/90 px-1 py-2 backdrop-blur-lg md:hidden">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          const badge = href === badgeHref && pendingCount > 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'relative flex flex-col items-center gap-0.5 px-2 py-1 text-[10px]',
                active ? 'text-neon-cyan' : 'text-slate-500',
              )}
            >
              <Icon size={19} />
              {badge && (
                <span className="absolute -top-0.5 right-0 h-2 w-2 rounded-full bg-neon-amber shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
              )}
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
