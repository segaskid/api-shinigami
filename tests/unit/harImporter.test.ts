import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { importHarFile } from '../../src/core/harImporter.js';

describe('har importer', () => {
  it('converts HAR entries to collection requests', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'shinigami-har-'));
    const file = path.join(dir, 'network.har');
    await writeFile(
      file,
      JSON.stringify({
        log: {
          entries: [
            {
              request: {
                method: 'POST',
                url: 'https://api.example.com/users',
                headers: [{ name: 'content-type', value: 'application/json' }],
                postData: { text: '{"name":"Light"}' },
              },
              response: { status: 201 },
            },
          ],
        },
      }),
    );
    const collection = await importHarFile(file);
    expect(collection.requests[0]).toMatchObject({
      method: 'POST',
      url: 'https://api.example.com/users',
    });
  });
});
