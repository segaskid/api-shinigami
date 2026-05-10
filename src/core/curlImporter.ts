import { parseHeader } from '../utils/headers.js';
import { toYaml } from '../utils/yaml.js';
import type { ApiCollection, CollectionRequest } from '../types/collection.js';

export interface ImportedCurlRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export function importCurl(command: string): ImportedCurlRequest {
  const tokens = tokenizeShell(command);
  const curlIndex = tokens.findIndex((token) => token === 'curl');
  const args = curlIndex >= 0 ? tokens.slice(curlIndex + 1) : tokens;
  const headers: Record<string, string> = {};
  let method: string | undefined;
  let body: string | undefined;
  let url: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === '-X' || token === '--request') {
      method = args[index + 1]?.toUpperCase();
      index += 1;
    } else if (token.startsWith('-X') && token.length > 2) {
      method = token.slice(2).toUpperCase();
    } else if (token === '-H' || token === '--header') {
      const [name, value] = parseHeader(args[index + 1] ?? '');
      headers[name] = value;
      index += 1;
    } else if (
      token === '-d' ||
      token === '--data' ||
      token === '--data-raw' ||
      token === '--data-binary'
    ) {
      body = args[index + 1] ?? '';
      method ??= 'POST';
      index += 1;
    } else if (!token.startsWith('-')) {
      url = token;
    } else if (optionTakesValue(token)) {
      index += 1;
    }
  }

  return {
    method: method ?? 'GET',
    url: url ?? '',
    headers,
    body,
  };
}

export function importedCurlToShinigamiCommand(request: ImportedCurlRequest): string {
  const parts = ['shinigami', 'request', request.method, quoteShell(request.url)];
  for (const [name, value] of Object.entries(request.headers)) {
    parts.push('--header', quoteShell(`${name}: ${value}`));
  }
  if (request.body !== undefined) {
    if (looksLikeJson(request.body)) {
      parts.push('--json-body', quoteShell(request.body));
    } else {
      parts.push('--body', quoteShell(request.body));
    }
  }
  return parts.join(' ');
}

export function importedCurlToCollectionYaml(
  request: ImportedCurlRequest,
  collectionName = 'Imported curl request',
): string {
  const collection: ApiCollection = {
    name: collectionName,
    version: 1,
    requests: [importedCurlToCollectionRequest(request)],
  };
  return toYaml(collection);
}

function importedCurlToCollectionRequest(request: ImportedCurlRequest): CollectionRequest {
  return {
    id: `${request.method.toLowerCase()}-imported`,
    name: `${request.method} ${request.url}`,
    method: request.method,
    url: request.url,
    headers: request.headers,
    ...(request.body
      ? {
          body: looksLikeJson(request.body)
            ? { json: JSON.parse(request.body) as unknown }
            : { raw: request.body },
        }
      : {}),
    assertions: [{ status: 200 }],
  };
}

function tokenizeShell(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | undefined;
  let escaped = false;

  for (const char of input.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if (quote) {
      if (char === quote) {
        quote = undefined;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current) {
    tokens.push(current);
  }
  return tokens;
}

function optionTakesValue(option: string): boolean {
  return ['--url', '--user', '--connect-timeout', '--max-time', '--user-agent'].includes(option);
}

function looksLikeJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

function quoteShell(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}
