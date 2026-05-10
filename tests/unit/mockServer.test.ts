import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createMockServerFromCollection } from '../../src/core/mockServer.js';

describe('mock server', () => {
  it('creates a server from collection routes', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'shinigami-mock-'));
    const file = path.join(dir, 'mock.yml');
    await writeFile(
      file,
      `name: Mock\nrequests:\n  - id: users\n    method: GET\n    url: "https://api.example.com/users"\n    assertions:\n      - status: 200\n`,
    );
    const server = await createMockServerFromCollection(file);
    expect(server.listening).toBe(false);
    server.close();
  });
});
