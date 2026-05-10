import http from 'node:http';
import { loadCollection } from './collectionRunner.js';
import { readDataFile } from '../utils/fs.js';

export async function createMockServerFromCollection(filePath: string): Promise<http.Server> {
  const collection = await loadCollection(filePath);
  const routes = new Map(
    collection.requests.map((request) => [
      `${request.method.toUpperCase()} ${pathname(request.url)}`,
      {
        status: firstStatus(request.assertions),
        body: { ok: true, mock: true, request: request.id ?? request.name ?? request.url },
      },
    ]),
  );

  return http.createServer((request, response) => {
    const key = `${request.method ?? 'GET'} ${new URL(request.url ?? '/', 'http://localhost').pathname}`;
    const route = routes.get(key);
    if (!route) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'No mock route matched.' }));
      return;
    }
    response.writeHead(route.status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(route.body));
  });
}

export async function createMockServerFromOpenApi(filePath: string): Promise<http.Server> {
  const spec = await readDataFile(filePath);
  const routes = new Map<string, { status: number; body: unknown }>();
  for (const [route, pathItem] of Object.entries(asRecord(asRecord(spec).paths))) {
    for (const [method, operation] of Object.entries(asRecord(pathItem))) {
      const status = firstResponseStatus(asRecord(operation));
      routes.set(`${method.toUpperCase()} ${route.replaceAll(/\{[^}]+}/g, '[^/]+')}`, {
        status,
        body: { ok: true, mock: true },
      });
    }
  }
  return http.createServer((request, response) => {
    const requestPath = new URL(request.url ?? '/', 'http://localhost').pathname;
    const route = [...routes.entries()].find(([pattern]) => {
      const [method, pathPattern] = pattern.split(' ');
      return method === request.method && new RegExp(`^${pathPattern}$`).test(requestPath);
    })?.[1];
    if (!route) {
      response.writeHead(404, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'No mock route matched.' }));
      return;
    }
    response.writeHead(route.status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(route.body));
  });
}

function pathname(url: string): string {
  return new URL(url, 'http://localhost').pathname;
}

function firstStatus(assertions: import('../types/assertions.js').Assertion[] = []): number {
  const status = assertions.find((assertion) => 'status' in assertion);
  return status && 'status' in status ? status.status : 200;
}

function firstResponseStatus(operation: Record<string, unknown>): number {
  const status = Object.keys(asRecord(operation.responses)).find((key) => /^\d+$/.test(key));
  return status ? Number(status) : 200;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
