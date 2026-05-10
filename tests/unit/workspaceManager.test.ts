import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { initWorkspace, workspaceDoctor } from '../../src/core/workspaceManager.js';

describe('workspace manager', () => {
  it('initializes and validates a workspace', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'shinigami-workspace-'));
    const status = await initWorkspace(root);
    expect(status.initialized).toBe(true);
    const doctor = await workspaceDoctor(root);
    expect(doctor.ok).toBe(true);
  });
});
