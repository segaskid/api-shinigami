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
  origin
    .intercept({ method: 'POST', path: '/login' })
    .reply(
      200,
      { accessToken: 'secret-token' },
      { headers: { 'content-type': 'application/json' } },
    )
    .persist();
  origin
    .intercept({ method: 'GET', path: '/me' })
    .reply(
      200,
      { id: 7, email: 'owner@example.com' },
      { headers: { 'content-type': 'application/json' } },
    )
    .persist();
  origin
    .intercept({ method: 'GET', path: '/' })
    .reply(
      200,
      `<html><head><script src="/bundle.js"></script></head><body><form action="/api/login" method="post"></form></body></html>`,
      { headers: { 'content-type': 'text/html' } },
    )
    .persist();
  origin
    .intercept({ method: 'GET', path: '/bundle.js' })
    .reply(200, `fetch('/api/users', { method: 'POST' });`, {
      headers: { 'content-type': 'application/javascript' },
    })
    .persist();
  origin
    .intercept({ method: 'POST', path: '/graphql' })
    .reply(
      200,
      { data: { viewer: { id: 1 } } },
      { headers: { 'content-type': 'application/json' } },
    )
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

  it('runs captures, dependencies, and data-driven reporters', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'shinigami-'));
    const collectionFile = path.join(dir, 'flow.yml');
    const dataFile = path.join(dir, 'users.csv');
    const junitFile = path.join(dir, 'report.xml');
    await writeFile(dataFile, 'email\nowner@example.com\nowner@example.com\n');
    await writeFile(
      collectionFile,
      `name: Flow\nenvironments:\n  local:\n    baseUrl: "${baseUrl}"\ndefaults:\n  headers:\n    Accept: application/json\nrequests:\n  - id: login\n    name: Login\n    method: POST\n    url: "{{baseUrl}}/login"\n    body:\n      json:\n        email: "{{email}}"\n    captures:\n      token:\n        jsonPath: "$.accessToken"\n        secret: true\n    assertions:\n      - status: 200\n  - id: me\n    name: Current user\n    dependsOn: login\n    method: GET\n    url: "{{baseUrl}}/me"\n    headers:\n      Authorization: "Bearer {{token}}"\n    responseSchema:\n      type: object\n      required: [id, email]\n      properties:\n        id:\n          type: number\n        email:\n          type: string\n    assertions:\n      - status: 200\n      - jsonPath: "$.email"\n        equals: "{{email}}"\n`,
    );

    const result = await runCli([
      'test',
      collectionFile,
      '--env',
      'local',
      '--data',
      dataFile,
      '--reporter',
      'junit',
      '--output',
      junitFile,
    ]);
    expect(result.stdout).toBe('');
    const report = await import('node:fs/promises').then((fs) => fs.readFile(junitFile, 'utf8'));
    expect(report).toContain('<testsuite');
    expect(report).toContain('failures="0"');
  });

  it('imports curl snippets and filters collection runs', async () => {
    const imported = await runCli([
      'import',
      'curl',
      `curl -X POST ${baseUrl}/echo -H 'Content-Type: application/json' --data-raw '{"hello":"world"}'`,
    ]);
    expect(imported.stdout).toContain('shinigami request POST');
    expect(imported.stdout).toContain('--json-body');

    const dir = await mkdtemp(path.join(tmpdir(), 'shinigami-filter-'));
    const file = path.join(dir, 'filter.yml');
    await writeFile(
      file,
      `name: Filter\nrequests:\n  - id: users\n    name: Users\n    method: GET\n    url: "${baseUrl}/users"\n    assertions:\n      - status: 200\n  - id: ignored\n    name: Ignored\n    method: GET\n    url: "${baseUrl}/missing"\n    assertions:\n      - status: 200\n`,
    );
    const filtered = await runCli(['collection', 'run', file, '--filter', 'users']);
    expect(filtered.stdout).toContain('Passed: 1');
    expect(filtered.stdout).not.toContain('Ignored');
  });

  it('sniffs page endpoints and can write a collection', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'shinigami-sniff-'));
    const output = path.join(dir, 'sniffed.yml');
    const result = await runCli(['sniff', baseUrl, '--collection', output]);
    expect(result.stdout).toContain('Endpoints found: 2');
    expect(result.stdout).toContain(`${baseUrl}/api/login`);
    expect(result.stdout).toContain(`${baseUrl}/api/users`);
    const collection = await import('node:fs/promises').then((fs) => fs.readFile(output, 'utf8'));
    expect(collection).toContain('Sniffed API');
    expect(collection).toContain(`${baseUrl}/api/users`);
  });

  it('runs graphql query and explains failures', async () => {
    const graphql = await runCli([
      '--json',
      'graphql',
      'query',
      `${baseUrl}/graphql`,
      '--query',
      'query { viewer { id } }',
    ]);
    expect(JSON.parse(graphql.stdout).response.status).toBe(200);

    const explained = await runCli(['explain', 'ETIMEDOUT after 5000ms']);
    expect(explained.stdout).toContain('Timeout');
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
