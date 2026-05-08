import { Buffer } from 'node:buffer';
import { readTextFile } from '../utils/fs.js';
import { appendQueryParams } from '../utils/url.js';
import type { BuiltRequest, RequestInput } from '../types/api.js';

export const DEFAULT_TIMEOUT_MS = 30_000;

export async function buildRequest(input: RequestInput): Promise<BuiltRequest> {
  const headers: Record<string, string> = { ...(input.headers ?? {}) };
  const query = { ...(input.query ?? {}) };

  let body: string | undefined;

  if (input.auth) {
    applyAuth(input.auth, headers, query);
  }

  if (input.json !== undefined) {
    headers['content-type'] ??= 'application/json';
    body = JSON.stringify(input.json);
  } else if (input.form) {
    headers['content-type'] ??= 'application/x-www-form-urlencoded';
    body = new URLSearchParams(input.form).toString();
  } else if (input.body !== undefined) {
    body = await resolveBody(input.body);
  }

  return {
    method: input.method.toUpperCase(),
    url: appendQueryParams(input.url, query),
    headers,
    body,
    timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    retries: input.retries ?? 0,
    followRedirects: input.followRedirects ?? true,
  };
}

async function resolveBody(value: string): Promise<string> {
  if (value.startsWith('@')) {
    return readTextFile(value.slice(1));
  }

  try {
    const stat = await import('node:fs/promises').then((fs) => fs.stat(value));
    if (stat.isFile()) {
      return readTextFile(value);
    }
  } catch {
    return value;
  }

  return value;
}

function applyAuth(
  auth: NonNullable<RequestInput['auth']>,
  headers: Record<string, string>,
  query: Record<string, string>,
): void {
  if (auth.type === 'bearer' && auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  if (auth.type === 'basic' && auth.username !== undefined && auth.password !== undefined) {
    const encoded = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
    headers.Authorization = `Basic ${encoded}`;
  }

  if (auth.type === 'api-key' && auth.name && auth.value) {
    if (auth.in === 'query') {
      query[auth.name] = auth.value;
    } else {
      headers[auth.name] = auth.value;
    }
  }
}
