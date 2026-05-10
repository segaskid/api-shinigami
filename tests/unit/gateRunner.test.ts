import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { runGate } from '../../src/core/gateRunner.js';

const baseUrl = 'http://gate.test';
let mockAgent: MockAgent;

beforeAll(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  mockAgent
    .get(baseUrl)
    .intercept({ method: 'GET', path: '/health' })
    .reply(200, { ok: true })
    .persist();
  setGlobalDispatcher(mockAgent);
});

afterAll(async () => {
  await mockAgent.close();
});

describe('gate runner', () => {
  it('runs collection gate checks', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'shinigami-gate-'));
    const collection = path.join(dir, 'api.yml');
    await writeFile(
      collection,
      `name: Gate\nrequests:\n  - id: health\n    method: GET\n    url: "${baseUrl}/health"\n    assertions:\n      - status: 200\n`,
    );
    await expect(runGate({ collection })).resolves.toMatchObject({ ok: true });
  });
});
