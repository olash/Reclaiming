import { NextResponse } from 'next/server';

/** An error that is safe to show to the person using the app. */
export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}

export function json(body: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export function fail(status: number, message: string, code?: string, extra?: Record<string, unknown>) {
  return json({ error: message, ...(code ? { code } : {}), ...extra }, status);
}

/**
 * Wraps a route handler so every failure becomes a clean JSON response.
 * Unexpected errors are logged server-side and never leak internals to the browser.
 */
export function route(tag: string, handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      return await handler(request);
    } catch (err) {
      if (err instanceof HttpError) return fail(err.status, err.message, err.code, err.extra);
      console.error(`[${tag}] Unhandled error:`, err instanceof Error ? err.message : err);
      return fail(500, 'Something went wrong on our side. Please try again in a moment.', 'INTERNAL');
    }
  };
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T> {
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object') throw new Error('not an object');
    return body as T;
  } catch {
    throw new HttpError(400, 'The request could not be read. Please try again.', 'INVALID_JSON');
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function assertUuid(value: unknown, what = 'id'): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new HttpError(400, `A valid ${what} is required.`, 'INVALID_ID');
  return value;
}
