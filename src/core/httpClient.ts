import { request as undiciRequest, errors, interceptors } from 'undici';
import { ExitCode } from './exitCodes.js';
import { ShinigamiError } from './errors.js';
import { tryParseJson } from '../utils/json.js';
import type { BuiltRequest, ShinigamiResponse } from '../types/api.js';
import * as http from 'node:http';
import * as https from 'node:https';

const RETRY_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

// Blocked IP ranges to prevent SSRF attacks
const BLOCKED_IP_PATTERNS = [
  /^127\./, // localhost IPv4
  /^10\./, // private network
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // private network
  /^192\.168\./, // private network
  /^169\.254\./, // link-local
  /^0\.0\.0\.0/, // all interfaces
  /^::1$/, // localhost IPv6
  /^fe80:/, // link-local IPv6
  /^fc00:/, // unique local IPv6
];

function isBlockedHost(hostname: string): boolean {
  const lowerHost = hostname.toLowerCase();
  // Block localhost variations
  if (lowerHost === 'localhost' || lowerHost.endsWith('.localhost')) {
    return true;
  }
  // Block internal domains
  if (lowerHost === 'internal' || lowerHost.endsWith('.internal')) {
    return true;
  }
  // Block cloud metadata endpoints
  if (
    lowerHost === 'metadata.google.internal' ||
    lowerHost.endsWith('.metadata.google.internal') ||
    lowerHost === '169.254.169.254'
  ) {
    return true;
  }
  return false;
}

function validateUrl(urlString: string): void {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new ShinigamiError({
      code: 'INVALID_URL',
      message: `Invalid URL: ${urlString}`,
      hint: 'Provide a valid HTTP or HTTPS URL.',
      exitCode: ExitCode.NetworkError,
    });
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ShinigamiError({
      code: 'UNSUPPORTED_PROTOCOL',
      message: `Unsupported protocol: ${url.protocol}`,
      hint: 'Only HTTP and HTTPS URLs are allowed.',
      exitCode: ExitCode.NetworkError,
    });
  }

  // Skip SSRF checks in test mode (when NODE_ENV=test)
  if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
    return;
  }

  const hostname = url.hostname;
  if (isBlockedHost(hostname)) {
    throw new ShinigamiError({
      code: 'SSRF_BLOCKED',
      message: `Access to internal host ${hostname} is blocked for security reasons.`,
      hint: 'SSRF protection prevents access to localhost, internal networks, and cloud metadata endpoints.',
      exitCode: ExitCode.NetworkError,
    });
  }

  // Check if hostname matches blocked IP patterns
  for (const pattern of BLOCKED_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      throw new ShinigamiError({
        code: 'SSRF_BLOCKED',
        message: `Access to internal IP ${hostname} is blocked for security reasons.`,
        hint: 'SSRF protection prevents access to localhost, internal networks, and cloud metadata endpoints.',
        exitCode: ExitCode.NetworkError,
      });
    }
  }
}

export async function sendHttpRequest(input: BuiltRequest): Promise<ShinigamiResponse> {
  // Validate URL before making request
  validateUrl(input.url);

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
  
  // Build options with optional redirect interceptor
  const requestOptions: any = {
    method: input.method,
    headers: input.headers,
    body: input.body,
    bodyTimeout: input.timeoutMs,
    headersTimeout: input.timeoutMs,
  };

  // Only add redirect interceptor if redirects should be followed
  // If followRedirects is false, we don't add the interceptor (default behavior is no redirects)
  if (input.followRedirects) {
    requestOptions.dispatcher = interceptors.redirect({ maxRedirections: 10 });
  }

  const response = await undiciRequest(input.url, requestOptions);
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
