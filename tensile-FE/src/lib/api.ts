export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/v1').replace(/\/$/, '');

/** Every backend error has the shape {"error": {"code", "message", "details?"}}. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

let authToken: string | null = null;

/** Set by the session provider whenever the signed-in wallet changes. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

type Init = { method?: string; body?: unknown; signal?: AbortSignal };

async function request(path: string, method: string, body: BodyInit | undefined, json: boolean, signal?: AbortSignal): Promise<Response> {
  const res = await fetch(API_URL + path, {
    method,
    headers: {
      ...(json ? { 'content-type': 'application/json' } : {}),
      ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    },
    body,
    signal,
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => null))?.error;
    throw new ApiError(res.status, e?.code ?? 'http_error', e?.message ?? res.statusText, e?.details);
  }
  return res;
}

export async function api<T>(path: string, init: Init = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await request(path, init.method ?? (hasBody ? 'POST' : 'GET'), hasBody ? JSON.stringify(init.body) : undefined, hasBody, init.signal);
  return (res.status === 204 ? null : await res.json().catch(() => null)) as T;
}

/** multipart/form-data POST (file uploads); the browser sets the boundary header. */
export async function apiForm<T>(path: string, form: FormData): Promise<T> {
  return (await (await request(path, 'POST', form, false)).json()) as T;
}

/** Authenticated download, e.g. a KYC document: returns the file as a Blob. */
export async function apiBlob(path: string): Promise<Blob> {
  return (await request(path, 'GET', undefined, false)).blob();
}
