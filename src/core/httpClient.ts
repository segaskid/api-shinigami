import { request as undiciRequest, errors } from 'undici';
import { ExitCode } from './exitCodes.js';
import { ShinigamiError } from './errors.js';
import { tryParseJson } from '../utils/json.js';
import type { BuiltRequest, ShinigamiResponse } from '../types/api.js';

const RETRY_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

export async function sendHttpRequest(input: BuiltRequest): Promise<ShinigamiResponse> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= input.retries; attempt += 1) {
    try {
      const response = await execute(input);
      if (!RETRY_STATUS_CODES.has(response.status) || attempt === input.retries) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === input.retries) {
        throw normalizeHttpError(error, input);
      }
    }
  }

  throw normalizeHttpError(lastError, input);
}

async function execute(input: BuiltRequest): Promise<ShinigamiResponse> {
  const started = performance.now();
  const response = await undiciRequest(input.url, {
    method: input.method,
    headers: input.headers,
    body: input.body,
    bodyTimeout: input.timeoutMs,
    headersTimeout: input.timeoutMs,
  });
  const bodyText = await response.body.text();
  const durationMs = performance.now() - started;
  const bodyJson = tryParseJson(bodyText);

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(response.headers)) {
    headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
  }

  return {
    status: response.statusCode,
    statusText: response.statusText,
    headers,
    bodyText,
    ...(bodyJson !== undefined ? { bodyJson } : {}),
    durationMs,
    sizeBytes: Buffer.byteLength(bodyText),
    redirected: false,
    url: input.url,
  };
}

function normalizeHttpError(error: unknown, input: BuiltRequest): ShinigamiError {
  if (error instanceof errors.HeadersTimeoutError || error instanceof errors.BodyTimeoutError) {
    return new ShinigamiError({
      code: 'NETWORK_TIMEOUT',
      message: `Connection timed out after ${input.timeoutMs}ms.`,
      hint: 'Check the URL, network connection, or increase --timeout.',
      exitCode: ExitCode.Timeout,
    });
  }

  const reason = error instanceof Error ? error.message : 'Network request failed.';
  return new ShinigamiError({
    code: 'NETWORK_ERROR',
    message: `Failed to connect to ${input.url}.`,
    reason,
    hint: 'Check the URL and network connection.',
    exitCode: ExitCode.NetworkError,
  });
}
