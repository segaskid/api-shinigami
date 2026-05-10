import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { replayHar } from '../../src/core/replayEngine.js';

const baseUrl = 'http://replay.test';
let mockAgent: MockAgent;

beforeAll(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  mockAgent
    .get(baseUrl)
    .intercept({ method: 'GET', path: '/users' })
    .reply(200, { ok: true })
    .persist();
  setGlobalDispatcher(mockAgent);
});

afterAll(async () => {
  await mockAgent.close();
});

describe('replay engine', () => {
  it('replays HAR traffic against a rewritten target', async () => {
    const file = await writeHar();
    await expect(replayHar({ file, target: baseUrl })).resolves.toMatchObject({
      total: 1,
      passed: 1,
      failed: 0,
    });
  });
});

async function writeHar(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'shinigami-replay-'));
  const file = path.join(dir, 'traffic.har');
  await writeFile(
    file,
    JSON.stringify({
      log: {
        entries: [
          {
            request: { method: 'GET', url: 'https://api.example.com/users', headers: [] },
            response: { status: 200, content: { text: '{"ok":true}' } },
          },
        ],
      },
    }),
  );
  return file;
}
