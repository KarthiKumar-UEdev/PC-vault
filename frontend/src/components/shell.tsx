'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  Bell,
  Boxes,
  LayoutDashboard,
  LogOut,
  Monitor,
  ScanLine,
  Wrench,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearToken, getRole, getToken } from '@/lib/auth';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/pcs', label: 'PCs', icon: Monitor },
  { href: '/inventory', label: 'Inventory', icon: Boxes },
  { href: '/planner', label: 'Planner', icon: Wrench },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/scan', label: 'Scan', icon: ScanLine },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  // read after mount — localStorage isn't available during prerender
  const [hasSession, setHasSession] = useState(false);
  useEffect(() => setHasSession(!!getToken()), [pathname]);

  const logout = () => {
    clearToken();
    setHasSession(false);
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
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
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
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center justify-between px-5 pb-5">
          <p className="font-mono text-[10px] text-slate-600">
            v1.0 //{' '}
            {hasSession && getRole() === 'manager' ? (
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
      </aside>

      {/* ── mobile top bar ──────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex items-center justify-center border-b border-line bg-void/80 py-3 backdrop-blur-lg md:hidden">
        <span className="font-display text-base font-bold tracking-widest neon-text">
          PC VAULT
        </span>
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
      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-line bg-void/90 py-2 backdrop-blur-lg md:hidden">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1 text-[10px]',
                active ? 'text-neon-cyan' : 'text-slate-500',
              )}
            >
              <Icon size={19} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
