'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Activity, CheckCircle2, KeyRound, LogOut, Save, Settings as SettingsIcon,
  ShieldCheck, UserRound,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CardTitle, GlassCard } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { clearToken, setSession } from '@/lib/auth';
import { useRole } from '@/lib/use-role';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const router = useRouter();
  const role = useRole();

  const authStatus = useQuery({ queryKey: ['auth-status'], queryFn: api.authStatus });
  const authRequired = authStatus.data?.auth_required ?? true;
  const me = useQuery({ queryKey: ['me'], queryFn: api.me, enabled: authRequired });

  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // prefill the username once the account loads
  useEffect(() => {
    if (me.data?.username) setUsername(me.data.username);
  }, [me.data?.username]);

  const usernameChanged = me.data != null && username.trim() !== me.data.username;
  const passwordChanged = newPassword.length > 0;
  const passwordsMatch = newPassword === confirmPassword;
  const canSave =
    (usernameChanged || passwordChanged) &&
    currentPassword.length > 0 &&
    (!passwordChanged || passwordsMatch);

  const save = useMutation({
    mutationFn: () =>
      api.updateProfile({
        current_password: currentPassword,
        username: usernameChanged ? username.trim() : undefined,
        new_password: passwordChanged ? newPassword : undefined,
      }),
    onSuccess: ({ token, role: newRole, username: newName }) => {
      // old token just died (password version changed) — swap in the new one
      setSession(token, newRole, newName);
      setNewPassword('');
      setConfirmPassword('');
      setCurrentPassword('');
      setError('');
      setSaved(true);
      me.refetch();
    },
    onError: (e) => {
      setSaved(false);
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
    },
  });

  const logout = () => {
    clearToken();
    router.push('/login/');
  };

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="flex items-center gap-3 font-display text-2xl font-bold text-slate-100">
          <SettingsIcon size={22} className="text-neon-cyan" />
          Settings
        </h1>
        <p className="mt-1 font-mono text-xs text-slate-500">// account & security</p>
      </header>

      {!authRequired ? (
        <GlassCard>
          <p className="text-sm text-slate-400">
            Authentication is disabled on this server — no accounts are configured, so there is
            nothing to manage here. Set <code className="font-mono text-neon-amber">ADMIN_USERNAME</code>{' '}
            and <code className="font-mono text-neon-amber">ADMIN_PASSWORD</code> in the backend{' '}
            <code className="font-mono text-neon-amber">.env</code> and restart to enable logins.
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-6">
          {/* account */}
          <GlassCard>
            <CardTitle className="mb-4 flex items-center gap-2">
              <UserRound size={13} /> Account
            </CardTitle>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (canSave && !save.isPending) save.mutate();
              }}
            >
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  autoComplete="username"
                  onChange={(e) => { setUsername(e.target.value); setSaved(false); }}
                  placeholder={me.isPending ? 'loading…' : 'username'}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setSaved(false); }}
                    placeholder="leave empty to keep current"
                    className="font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setSaved(false); }}
                    placeholder="repeat it"
                    className="font-mono"
                  />
                </div>
              </div>
              {passwordChanged && !passwordsMatch && confirmPassword.length > 0 && (
                <p className="text-xs text-neon-amber">Passwords don&apos;t match yet.</p>
              )}
              {passwordChanged && newPassword.length < 8 && (
                <p className="text-xs text-neon-amber">Password needs at least 8 characters.</p>
              )}
              <div className="border-t border-line pt-4">
                <Label htmlFor="current-password">Current password (required to save)</Label>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); setSaved(false); }}
                  placeholder="••••••••"
                  className="font-mono"
                />
              </div>
              {error && <p className="text-sm text-neon-red">{error}</p>}
              {saved && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-sm text-neon-green"
                >
                  <CheckCircle2 size={15} /> Saved. Your session was refreshed with a new token.
                </motion.p>
              )}
              <Button
                type="submit"
                variant="solid"
                disabled={!canSave || (passwordChanged && newPassword.length < 8) || save.isPending}
              >
                <Save size={15} /> {save.isPending ? 'Saving…' : 'Save changes'}
              </Button>
            </form>
          </GlassCard>

          {/* security */}
          <GlassCard>
            <CardTitle className="mb-4 flex items-center gap-2">
              <ShieldCheck size={13} /> Security
            </CardTitle>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li className="flex items-start gap-2.5">
                <KeyRound size={14} className="mt-0.5 shrink-0 text-neon-cyan" />
                Passwords are stored PBKDF2-hashed — never in plain text.
              </li>
              <li className="flex items-start gap-2.5">
                <ShieldCheck size={14} className="mt-0.5 shrink-0 text-neon-cyan" />
                Changing your password signs out every other device instantly —
                old tokens stop working the moment you save.
              </li>
              <li className="flex items-start gap-2.5">
                <Activity size={14} className="mt-0.5 shrink-0 text-neon-cyan" />
                Sessions expire automatically after 30 days.
              </li>
            </ul>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
              <p className="font-mono text-xs text-slate-500">
                signed in as{' '}
                <span className="text-neon-cyan">{me.data?.username ?? '…'}</span>
                {' · '}
                <span className={cn(role === 'manager' ? 'text-neon-violet' : 'text-neon-green')}>
                  {role ?? '…'}
                </span>
              </p>
              <Button variant="danger" size="sm" onClick={logout}>
                <LogOut size={13} /> Log out
              </Button>
            </div>
          </GlassCard>

          {/* system */}
          <GlassCard>
            <CardTitle className="mb-4 flex items-center gap-2">
              <Activity size={13} /> System
            </CardTitle>
            <dl className="grid gap-x-8 gap-y-2 font-mono text-xs sm:grid-cols-2">
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">app version</dt>
                <dd className="text-slate-300">v1.0</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">authentication</dt>
                <dd className="text-neon-green">enabled</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">manager approvals</dt>
                <dd className={authStatus.data?.manager_enabled ? 'text-neon-green' : 'text-slate-400'}>
                  {authStatus.data?.manager_enabled ? 'on' : 'off'}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">api</dt>
                <dd className="text-slate-300">{process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}</dd>
              </div>
            </dl>
          </GlassCard>
        </div>
      )}
    </div>
  );
}
