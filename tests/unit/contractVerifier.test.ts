import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { verifyOpenApiContract } from '../../src/core/contractVerifier.js';

const baseUrl = 'http://contract.test';
let mockAgent: MockAgent;

beforeAll(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  mockAgent
    .get(baseUrl)
    .intercept({ method: 'GET', path: '/users/1' })
    .reply(200, { id: 1 }, { headers: { 'content-type': 'application/json' } })
    .persist();
  setGlobalDispatcher(mockAgent);
});

afterAll(async () => {
  await mockAgent.close();
});

describe('contract verifier', () => {
  it('verifies safe OpenAPI operations against a base URL', async () => {
    const file = await writeOpenApi();
    const result = await verifyOpenApiContract({ openApiFile: file, baseUrl });
    expect(result).toMatchObject({ ok: true, checked: 1, skipped: 0 });
  });
});

async function writeOpenApi(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'shinigami-contract-'));
  const file = path.join(dir, 'openapi.json');
  await writeFile(
    file,
    JSON.stringify({
      openapi: '3.0.3',
      paths: {
        '/users/{id}': {
          get: {
            responses: {
              '200': {
                description: 'OK',
                content: { 'application/json': { schema: { type: 'object', required: ['id'] } } },
              },
            },
          },
        },
      },
    }),
  );
  return file;
}
