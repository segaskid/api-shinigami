import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadDataRows } from '../../src/core/dataLoader.js';

describe('data loader', () => {
  it('loads CSV rows', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'shinigami-data-'));
    const file = path.join(dir, 'rows.csv');
    await writeFile(file, 'email,name\nlight@example.com,Light\nmisa@example.com,Misa\n');
    await expect(loadDataRows(file)).resolves.toEqual([
      { email: 'light@example.com', name: 'Light' },
      { email: 'misa@example.com', name: 'Misa' },
    ]);
  });
});
