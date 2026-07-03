const TOKEN_KEY = 'pcv_token';
const ROLE_KEY = 'pcv_role';

export type Role = 'admin' | 'manager';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setSession(token: string, role: Role): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(ROLE_KEY, role);
}

/** Stored role; defaults to admin when auth is disabled (open dev mode). */
export function getRole(): Role {
  if (typeof window === 'undefined') return 'admin';
  const role = window.localStorage.getItem(ROLE_KEY);
  return role === 'manager' ? 'manager' : 'admin';
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(ROLE_KEY);
}

/** Routes that must work without a session (public QR landing + login itself). */
export function isPublicPath(pathname: string): boolean {
  return pathname.startsWith('/login') || pathname.startsWith('/pc/qr');
}
