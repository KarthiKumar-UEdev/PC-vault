import type {
  Build,
  BuildDetail,
  BuildItem,
  NetworkInfo,
  Part,
  PartAging,
  PartInput,
  PC,
  PCDetail,
  PCInput,
  Stats,
  TransferLog,
} from './types';

import { clearToken, getToken, isPublicPath } from './auth';

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000').replace(/\/$/, '');
const API = `${BASE}/api/v1`;

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    // Session missing/expired → send the user to the login screen
    if (res.status === 401 && !path.startsWith('/auth/') && typeof window !== 'undefined') {
      clearToken();
      if (!isPublicPath(window.location.pathname)) {
        window.location.href = '/login/';
      }
    }
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body.detail === 'string') detail = body.detail;
    } catch {
      /* not json */
    }
    throw new ApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export const api = {
  // Auth
  authStatus: () => request<{ auth_required: boolean }>('/auth/status'),
  login: (password: string) =>
    request<{ token: string; expires_in: number }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  // PCs
  listPCs: (params: { status?: string; search?: string; sort?: string; order?: string } = {}) =>
    request<PC[]>(`/pcs${qs(params)}`),
  getPC: (id: string) => request<PCDetail>(`/pcs/${id}`),
  getPCByQR: (token: string) => request<PCDetail>(`/pcs/qr/${token}`),
  createPC: (data: PCInput) =>
    request<PCDetail>('/pcs', { method: 'POST', body: JSON.stringify(data) }),
  updatePC: (id: string, data: Partial<PCInput>) =>
    request<PCDetail>(`/pcs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePC: (id: string) => request<{ ok: boolean }>(`/pcs/${id}`, { method: 'DELETE' }),
  // <img>/<a download> can't send headers — pass the token as a query param
  qrImageUrl: (id: string) => {
    const token = getToken();
    return `${API}/pcs/${id}/qr-image${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  },

  // Parts
  listParts: (
    params: {
      type?: string; condition?: string; pc_id?: string; in_inventory?: boolean;
      search?: string; sort?: string; order?: string;
    } = {},
  ) => request<Part[]>(`/parts${qs(params)}`),
  getPart: (id: string) => request<Part>(`/parts/${id}`),
  createPart: (data: PartInput) =>
    request<Part>('/parts', { method: 'POST', body: JSON.stringify(data) }),
  updatePart: (id: string, data: Partial<PartInput>) =>
    request<Part>(`/parts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deletePart: (id: string) => request<{ ok: boolean }>(`/parts/${id}`, { method: 'DELETE' }),
  transferPart: (id: string, toPcId: string | null) =>
    request<Part>(`/parts/${id}/transfer`, {
      method: 'POST',
      body: JSON.stringify({ to_pc_id: toPcId }),
    }),
  partHistory: (id: string) => request<TransferLog[]>(`/parts/${id}/history`),
  partsAging: () => request<PartAging[]>('/parts/aging'),

  // Network
  getNetwork: (pcId: string) => request<NetworkInfo>(`/pcs/${pcId}/network`),
  putNetwork: (pcId: string, data: Omit<NetworkInfo, 'pc_id'>) =>
    request<NetworkInfo>(`/pcs/${pcId}/network`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Planner
  listBuilds: () => request<Build[]>('/builds'),
  getBuild: (id: string) => request<BuildDetail>(`/builds/${id}`),
  createBuild: (data: { name: string; notes?: string | null }) =>
    request<BuildDetail>('/builds', { method: 'POST', body: JSON.stringify(data) }),
  updateBuild: (id: string, data: { name?: string; notes?: string | null }) =>
    request<BuildDetail>(`/builds/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteBuild: (id: string) => request<{ ok: boolean }>(`/builds/${id}`, { method: 'DELETE' }),
  addBuildItem: (
    buildId: string,
    data: {
      part_id?: string;
      external_type?: string;
      external_name?: string;
      external_price?: string;
      external_url?: string;
    },
  ) => request<BuildItem>(`/builds/${buildId}/items`, { method: 'POST', body: JSON.stringify(data) }),
  removeBuildItem: (buildId: string, itemId: string) =>
    request<{ ok: boolean }>(`/builds/${buildId}/items/${itemId}`, { method: 'DELETE' }),
  convertBuild: (buildId: string, data: { name?: string; description?: string } = {}) =>
    request<PCDetail>(`/builds/${buildId}/convert`, { method: 'POST', body: JSON.stringify(data) }),

  // Alerts & dashboard
  warrantyAlerts: (days = 30) => request<Part[]>(`/alerts/warranty?days=${days}`),
  stats: () => request<Stats>('/stats'),
  recentTransfers: (limit = 8) => request<TransferLog[]>(`/transfers/recent?limit=${limit}`),
};
