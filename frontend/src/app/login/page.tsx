'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { KeyRound, Lock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { api, ApiError } from '@/lib/api';
import { setSession } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const { data: status } = useQuery({ queryKey: ['auth-status'], queryFn: api.authStatus });

  const login = useMutation({
    mutationFn: () => api.login(password),
    onSuccess: ({ token, role }) => {
      setSession(token, role);
      router.push('/');
    },
    onError: (e) => {
      setError(e instanceof ApiError && e.status === 401 ? 'Wrong password.' : e.message);
    },
  });

  return (
    <div className="grid min-h-[70vh] place-items-center">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="glass w-full max-w-sm border-neon-cyan/25 p-8"
      >
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-xl border border-neon-cyan/40 bg-gradient-to-br from-neon-cyan/20 to-neon-violet/20 shadow-glow-cyan">
            <Lock size={20} className="text-neon-cyan" />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold tracking-widest neon-text">
              VAULT ACCESS
            </h1>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">
              authorization required
            </p>
          </div>
        </div>

        {status && !status.auth_required ? (
          <p className="text-center text-sm text-slate-400">
            Authentication is disabled on this server (no <code className="font-mono text-neon-amber">ADMIN_PASSWORD</code> set)
            — the vault is open.{' '}
            <button className="text-neon-cyan hover:underline" onClick={() => router.push('/')}>
              Enter →
            </button>
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setError('');
              if (password) login.mutate();
            }}
          >
            <div>
              <Label htmlFor="password">Admin password</Label>
              <Input
                id="password"
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="font-mono"
              />
            </div>
            {error && <p className="text-sm text-neon-red">{error}</p>}
            <Button type="submit" variant="solid" className="w-full" disabled={!password || login.isPending}>
              <KeyRound size={15} />
              {login.isPending ? 'Verifying…' : 'Unlock vault'}
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
