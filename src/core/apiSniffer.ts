import { buildRequest } from './requestBuilder.js';
import { sendHttpRequest } from './httpClient.js';
import { ShinigamiError } from './errors.js';
import { ExitCode } from './exitCodes.js';
import { toYaml } from '../utils/yaml.js';
import type { ApiCollection } from '../types/collection.js';
import { createRequire } from 'node:module';

export interface SniffedEndpoint {
  method: string;
  url: string;
  source: string;
  kind: 'fetch' | 'xhr' | 'form' | 'link' | 'asset' | 'literal';
}

export interface SniffResult {
  pageUrl: string;
  scannedAssets: string[];
  endpoints: SniffedEndpoint[];
  notes: string[];
}

export interface SniffOptions {
  maxAssets?: number;
  includeExternal?: boolean;
  timeoutMs?: number;
  browser?: boolean;
}

const DEFAULT_MAX_ASSETS = 20;
const API_HINT =
  /\/(api|v\d+|graphql|rest|rpc|auth|oauth|users?|accounts?|sessions?|login|search|admin|webhooks?)(\/|$|\?|#)/i;

export async function sniffPageEndpoints(
  pageUrl: string,
  options: SniffOptions = {},
): Promise<SniffResult> {
  const normalizedPageUrl = normalizeAbsoluteUrl(pageUrl);
  const pageResponse = await sendHttpRequest(
    await buildRequest({ method: 'GET', url: normalizedPageUrl, timeoutMs: options.timeoutMs }),
  );
  const pageSource = pageResponse.bodyText;
  const assets = extractAssetUrls(pageSource, normalizedPageUrl, options);
  const scannedAssets: string[] = [];
  const endpoints = new Map<string, SniffedEndpoint>();

  addEndpoints(
    endpoints,
    extractEndpointsFromText(pageSource, normalizedPageUrl, normalizedPageUrl),
  );
  addEndpoints(endpoints, extractFormEndpoints(pageSource, normalizedPageUrl, normalizedPageUrl));

  for (const assetUrl of assets.slice(0, options.maxAssets ?? DEFAULT_MAX_ASSETS)) {
    try {
      const assetResponse = await sendHttpRequest(
        await buildRequest({ method: 'GET', url: assetUrl, timeoutMs: options.timeoutMs }),
      );
      scannedAssets.push(assetUrl);
      addEndpoints(
        endpoints,
        extractEndpointsFromText(assetResponse.bodyText, normalizedPageUrl, assetUrl),
      );
    } catch {
      // Asset fetch failures should not fail the page sniff.
    }
  }

  if (options.browser) {
    addEndpoints(endpoints, await sniffBrowserRuntime(normalizedPageUrl));
  }

  return {
    pageUrl: normalizedPageUrl,
    scannedAssets,
    endpoints: [...endpoints.values()].sort((left, right) => left.url.localeCompare(right.url)),
    notes: [
      'Static sniffing discovers endpoints present in HTML and fetched assets.',
      'Runtime-only requests created after user interaction may require browser instrumentation in a future release.',
    ],
  };
}

async function sniffBrowserRuntime(pageUrl: string): Promise<SniffedEndpoint[]> {
  const playwright = loadPlaywright();
  const browser = await playwright.chromium.launch({ headless: true });
  const endpoints = new Map<string, SniffedEndpoint>();
  try {
    const page = await browser.newPage();
    page.on('request', (request: BrowserRequest) => {
      const resourceType = request.resourceType();
      if (resourceType !== 'xhr' && resourceType !== 'fetch') return;
      endpoints.set(`${request.method()} ${request.url()}`, {
        method: request.method(),
        url: request.url(),
        source: pageUrl,
        kind: resourceType === 'xhr' ? 'xhr' : 'fetch',
      });
    });
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 30_000 });
    return [...endpoints.values()];
  } finally {
    await browser.close();
  }
}

interface BrowserRequest {
  method(): string;
  url(): string;
  resourceType(): string;
}

interface PlaywrightRuntime {
  chromium: {
    launch(options: { headless: boolean }): Promise<{
      newPage(): Promise<{
        on(event: 'request', handler: (request: BrowserRequest) => void): void;
        goto(url: string, options: { waitUntil: 'networkidle'; timeout: number }): Promise<unknown>;
      }>;
      close(): Promise<void>;
    }>;
  };
}

function loadPlaywright(): PlaywrightRuntime {
  try {
    const require = createRequire(import.meta.url);
    return require('playwright') as PlaywrightRuntime;
  } catch {
    throw new ShinigamiError({
      code: 'PLAYWRIGHT_NOT_INSTALLED',
      message: 'Browser sniffing requires Playwright.',
      hint: 'Install it with npm install -D playwright, then run shinigami sniff <url> --browser again.',
      exitCode: ExitCode.ConfigError,
    });
  }
}

export function sniffResultToCollectionYaml(result: SniffResult, name = 'Sniffed API'): string {
  const collection: ApiCollection = {
    name,
    version: 1,
    requests: result.endpoints.map((endpoint, index) => ({
      id: `sniffed-${index + 1}`,
      name: `${endpoint.method} ${new URL(endpoint.url).pathname}`,
      method: endpoint.method,
      url: endpoint.url,
      assertions: [{ status: 200 }],
    })),
  };
  return toYaml(collection);
}

function extractEndpointsFromText(
  text: string,
  pageUrl: string,
  source: string,
): SniffedEndpoint[] {
  return [
    ...extractFetchEndpoints(text, pageUrl, source),
    ...extractXhrEndpoints(text, pageUrl, source),
    ...extractLiteralEndpoints(text, pageUrl, source),
  ];
}

function extractFetchEndpoints(text: string, pageUrl: string, source: string): SniffedEndpoint[] {
  const endpoints: SniffedEndpoint[] = [];
  const fetchRegex = /\bfetch\s*\(\s*(['"`])([^'"`]+)\1([\s\S]{0,500}?)\)/g;
  for (const match of text.matchAll(fetchRegex)) {
    const url = resolveCandidate(match[2], pageUrl);
    if (!url) continue;
    endpoints.push({
      method: inferMethod(match[3]) ?? 'GET',
      url,
      source,
      kind: 'fetch',
    });
  }
  return endpoints;
}

function extractXhrEndpoints(text: string, pageUrl: string, source: string): SniffedEndpoint[] {
  const endpoints: SniffedEndpoint[] = [];
  const xhrRegex = /\bopen\s*\(\s*(['"`])([A-Z]+)\1\s*,\s*(['"`])([^'"`]+)\3/g;
  for (const match of text.matchAll(xhrRegex)) {
    const url = resolveCandidate(match[4], pageUrl);
    if (!url) continue;
    endpoints.push({
      method: match[2],
      url,
      source,
      kind: 'xhr',
    });
  }
  return endpoints;
}

function extractFormEndpoints(text: string, pageUrl: string, source: string): SniffedEndpoint[] {
  const endpoints: SniffedEndpoint[] = [];
  const formRegex = /<form\b[^>]*>/gi;
  for (const match of text.matchAll(formRegex)) {
    const tag = match[0];
    const action = getAttribute(tag, 'action');
    if (!action) continue;
    const url = resolveCandidate(action, pageUrl);
    if (!url) continue;
    endpoints.push({
      method: (getAttribute(tag, 'method') ?? 'GET').toUpperCase(),
      url,
      source,
      kind: 'form',
    });
  }
  return endpoints;
}

function extractLiteralEndpoints(text: string, pageUrl: string, source: string): SniffedEndpoint[] {
  const endpoints: SniffedEndpoint[] = [];
  const literalRegex = /(['"`])((?:https?:\/\/[^'"`\s<>)]+)|(?:\/[^'"`\s<>)]+))\1/g;
  for (const match of text.matchAll(literalRegex)) {
    const candidate = match[2];
    if (isExplicitEndpointContext(text, match.index ?? 0)) continue;
    if (!API_HINT.test(candidate)) continue;
    const url = resolveCandidate(candidate, pageUrl);
    if (!url) continue;
    endpoints.push({
      method: 'GET',
      url,
      source,
      kind: 'literal',
    });
  }
  return endpoints;
}

function isExplicitEndpointContext(text: string, index: number): boolean {
  const prefix = text.slice(Math.max(0, index - 32), index).toLowerCase();
  return (
    /\bfetch\s*\(\s*$/.test(prefix) ||
    /\baction\s*=\s*$/.test(prefix) ||
    /\bopen\s*\([^)]*$/.test(prefix)
  );
}

function extractAssetUrls(text: string, pageUrl: string, options: SniffOptions): string[] {
  const urls = new Set<string>();
  const assetRegex = /<(script|link)\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>/gi;
  const pageOrigin = new URL(pageUrl).origin;
  for (const match of text.matchAll(assetRegex)) {
    const url = resolveCandidate(match[2], pageUrl);
    if (!url) continue;
    const parsed = new URL(url);
    if (!options.includeExternal && parsed.origin !== pageOrigin) continue;
    if (!/\.(js|mjs|css)(\?|$)/i.test(parsed.pathname)) continue;
    urls.add(url);
  }
  return [...urls];
}

function addEndpoints(target: Map<string, SniffedEndpoint>, endpoints: SniffedEndpoint[]): void {
  for (const endpoint of endpoints) {
    target.set(`${endpoint.method} ${endpoint.url}`, endpoint);
  }
}

function resolveCandidate(candidate: string, pageUrl: string): string | undefined {
  if (
    candidate.startsWith('data:') ||
    candidate.startsWith('mailto:') ||
    candidate.startsWith('#')
  ) {
    return undefined;
  }
  try {
    return new URL(candidate, pageUrl).toString();
  } catch {
    return undefined;
  }
}

function inferMethod(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const methodMatch = text.match(/\bmethod\s*:\s*(['"`])([A-Z]+)\1/i);
  return methodMatch?.[2]?.toUpperCase();
}

function getAttribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(['"])(.*?)\\1`, 'i'));
  return match?.[2];
}

function normalizeAbsoluteUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  return `https://${url}`;
}
