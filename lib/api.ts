'use client';

import { supabase } from './supabase-browser';

/** An error whose message is already written for the person using the app. */
export class ApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public data?: Record<string, unknown>) {
    super(message);
  }
}

const OFFLINE = 'We could not reach Reclaiming. Check your internet connection and try again.';

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase().auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

async function parse(res: Response) {
  const type = res.headers.get('content-type') ?? '';
  const body = type.includes('json') ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    throw new ApiError(body.error || 'Something went wrong. Please try again.', res.status, body.code, body);
  }
  return body;
}

/** Calls one of our own API routes as the signed-in user. */
export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
      body: JSON.stringify(body ?? {}),
    });
  } catch {
    throw new ApiError(OFFLINE, 0, 'OFFLINE');
  }
  return parse(res);
}

export async function apiUpload<T = any>(path: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { method: 'POST', headers: await authHeader(), body: form });
  } catch {
    throw new ApiError(OFFLINE, 0, 'OFFLINE');
  }
  return parse(res);
}

/** Fetches a generated file and hands it to the browser as a download. */
export async function apiDownload(path: string, body: unknown, fallbackName: string) {
  let res: Response;
  try {
    res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeader()) }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError(OFFLINE, 0, 'OFFLINE');
  }
  if (!res.ok) await parse(res);
  const name = /filename="([^"]+)"/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName;
  saveBlob(await res.blob(), name);
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
