'use client';

import { useEffect, useState } from 'react';
import { getRole, type Role } from './auth';

/** Role for UI gating, hydration-safe (null until mounted).
 *  The backend enforces permissions regardless — this only hides controls. */
export function useRole(): Role | null {
  const [role, setRole] = useState<Role | null>(null);
  useEffect(() => setRole(getRole()), []);
  return role;
}

export function useIsAdmin(): boolean {
  return useRole() === 'admin';
}
