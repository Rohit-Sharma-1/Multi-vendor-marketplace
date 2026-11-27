import type { ApiErrorShape, User } from '../types';
const base = import.meta.env.VITE_API_BASE || '/api/v1';
let accessToken: string|null = null;
let refreshFlight: Promise<string|null>|null = null;
export function setAccessToken(token: string|null): void { accessToken = token; }
async function refreshAccessToken(): Promise<string|null> {
  if (!refreshFlight) refreshFlight = fetch(`${base}/auth/refresh`, { method: 'POST', credentials: 'include' }).then(async (res) => {
    if (!res.ok) return null;
    const body = await res.json() as { data?: { accessToken?: string } };
    accessToken = body.data?.accessToken ?? null; return accessToken;
  }).catch(() => null).finally(() => { refreshFlight = null; });
  return refreshFlight;
}
async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const response = await fetch(`${base}${path}`, { ...init, headers, credentials: 'include' });
  if (response.status === 401 && retry && !path.includes('/auth/refresh')) { const token = await refreshAccessToken(); if (token) return request<T>(path, init, false); accessToken = null; window.dispatchEvent(new Event('mvm:session-expired')); }
  if (!response.ok) { const body = await response.json().catch(() => ({})) as ApiErrorShape; throw new Error(body.error?.message || `Request failed (${response.status})`); }
  if (response.status === 204) return undefined as T;
  const body = await response.json() as { data?: T }; return body.data as T;
}
export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, headers?: Record<string,string>) => request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body), headers }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  async login(email: string, password: string): Promise<{accessToken:string;user:User}> { const result = await request<{accessToken:string;user:User}>('/auth/login', { method:'POST', body:JSON.stringify({email,password}) }, false); accessToken = result.accessToken; return result; },
  async register(email:string,password:string):Promise<void> { await request('/auth/register',{method:'POST',body:JSON.stringify({email,password})},false); },
  async registerVendor(email:string,password:string,businessName:string):Promise<{vendorId:string;status:string}> { return request('/vendors/register',{method:'POST',body:JSON.stringify({email,password,businessName})},false); },
  async restore():Promise<User|null> { if (!await refreshAccessToken()) return null; try { return await request<User>('/auth/me',{},false); } catch { accessToken=null; return null; } },
  async logout():Promise<void> { try { await request<void>('/auth/logout',{method:'POST'},false); } finally { accessToken=null; } },
};
