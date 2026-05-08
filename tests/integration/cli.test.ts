import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli as executeCli } from '../../src/cli.js';
import { MockAgent, setGlobalDispatcher } from 'undici';

let mockAgent: MockAgent;
const baseUrl = 'http://api-shinigami.test';

beforeAll(async () => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  const origin = mockAgent.get(baseUrl);
  origin
    .intercept({ method: 'GET', path: '/users' })
    .reply(
      200,
      { users: [{ id: 1 }], query: '/users' },
      { headers: { 'content-type': 'application/json' } },
    )
    .persist();
  origin
    .intercept({ method: 'POST', path: '/echo' })
    .reply(201, { body: { hello: 'world' } }, { headers: { 'content-type': 'application/json' } })
    .persist();
  setGlobalDispatcher(mockAgent);
});

afterAll(async () => {
  await mockAgent.close();
});

describe('cli integration', () => {
  it('runs request GET with JSON output', async () => {
    const result = await runCli(['--json', 'request', 'GET', `${baseUrl}/users`]);
    const payload = JSON.parse(result.stdout) as { ok: boolean; response: { status: number } };
    expect(payload.ok).toBe(true);
    expect(payload.response.status).toBe(200);
  });

  it('runs request POST with JSON body', async () => {
    const result = await runCli([
      '--json',
      'request',
      'POST',
      `${baseUrl}/echo`,
      '--json',
      '{"hello":"world"}',
    ]);
    const payload = JSON.parse(result.stdout) as {
      response: { status: number; bodyJson: { body: { hello: string } } };
    };
    expect(payload.response.status).toBe(201);
    expect(payload.response.bodyJson.body.hello).toBe('world');
  });

  it('runs a collection successfully and fails assertions with exit code 6', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'shinigami-'));
    const okFile = path.join(dir, 'ok.yml');
    await writeFile(
      okFile,
      `name: Integration\nenvironments:\n  local:\n    baseUrl: "${baseUrl}"\nrequests:\n  - name: Users\n    method: GET\n    url: "{{baseUrl}}/users"\n    assertions:\n      - status: 200\n      - jsonPath: "$.users.0.id"\n        equals: 1\n`,
    );
    const ok = await runCli(['collection', 'run', okFile, '--env', 'local']);
    expect(ok.stdout).toContain('Passed: 1');

    const failFile = path.join(dir, 'fail.yml');
    await writeFile(
      failFile,
      `name: Integration\nrequests:\n  - name: Users\n    method: GET\n    url: "${baseUrl}/users"\n    assertions:\n      - status: 201\n`,
    );
    await expect(runCli(['collection', 'run', failFile])).rejects.toMatchObject({ exitCode: 6 });
  });
});

async function runCli(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const originalStdout = process.stdout.write;
  const originalStderr = process.stderr.write;
  const originalExitCode = process.exitCode;
  let stdout = '';
  let stderr = '';

  process.stdout.write = ((chunk: string | Uint8Array) => {
    stdout += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += chunk.toString();
    return true;
  }) as typeof process.stderr.write;
  process.exitCode = undefined;

  try {
    await executeCli(['node', 'shinigami', ...args]);
    const result = { stdout, stderr, exitCode: Number(process.exitCode ?? 0) };
    if (result.exitCode === 0) return result;
    throw Object.assign(new Error(stderr || stdout), result);
  } finally {
    process.stdout.write = originalStdout;
    process.stderr.write = originalStderr;
    process.exitCode = originalExitCode;
  }
}
