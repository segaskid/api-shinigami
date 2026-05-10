import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { MockAgent, setGlobalDispatcher } from 'undici';
import { sniffPageEndpoints, sniffResultToCollectionYaml } from '../../src/core/apiSniffer.js';

const baseUrl = 'http://sniff-unit.test';
let mockAgent: MockAgent;

beforeAll(() => {
  mockAgent = new MockAgent();
  mockAgent.disableNetConnect();
  const origin = mockAgent.get(baseUrl);
  origin
    .intercept({ method: 'GET', path: '/' })
    .reply(
      200,
      `<html><head><script src="/app.js"></script></head><body><form action="/api/login" method="post"></form></body></html>`,
      { headers: { 'content-type': 'text/html' } },
    )
    .persist();
  origin
    .intercept({ method: 'GET', path: '/app.js' })
    .reply(
      200,
      `fetch('/api/users', { method: 'POST' }); const path = "/v1/search"; xhr.open('GET', '/api/me');`,
      { headers: { 'content-type': 'application/javascript' } },
    )
    .persist();
  setGlobalDispatcher(mockAgent);
});

afterAll(async () => {
  await mockAgent.close();
});

describe('api sniffer', () => {
  it('discovers forms, fetch calls, xhr calls, and API-like literals', async () => {
    const result = await sniffPageEndpoints(baseUrl);
    expect(result.scannedAssets).toEqual([`${baseUrl}/app.js`]);
    expect(result.endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: 'POST', url: `${baseUrl}/api/login`, kind: 'form' }),
        expect.objectContaining({ method: 'POST', url: `${baseUrl}/api/users`, kind: 'fetch' }),
        expect.objectContaining({ method: 'GET', url: `${baseUrl}/api/me`, kind: 'xhr' }),
        expect.objectContaining({ method: 'GET', url: `${baseUrl}/v1/search`, kind: 'literal' }),
      ]),
    );
    expect(sniffResultToCollectionYaml(result)).toContain('Sniffed API');
  });
});
