import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { inferOpenApiFromHar } from '../../src/core/schemaInferer.js';

describe('schema inferer', () => {
  it('infers OpenAPI paths and response schemas from HAR', async () => {
    const file = await writeHar({
      request: { method: 'GET', url: 'https://api.example.com/users/123?active=true', headers: [] },
      response: { status: 200, content: { text: '{"id":123,"name":"Light"}' } },
    });
    const spec = await inferOpenApiFromHar(file);
    expect(spec.paths['/users/{id}'].get).toMatchObject({
      parameters: [{ name: 'active', in: 'query', required: false, schema: { type: 'string' } }],
    });
  });
});

async function writeHar(entry: unknown): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'shinigami-schema-'));
  const file = path.join(dir, 'traffic.har');
  await writeFile(file, JSON.stringify({ log: { entries: [entry] } }));
  return file;
}
