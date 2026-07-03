const TOKEN_KEY = 'pcv_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

/** Routes that must work without a session (public QR landing + login itself). */
export function isPublicPath(pathname: string): boolean {
  return pathname.startsWith('/login') || pathname.startsWith('/pc/qr');
}
