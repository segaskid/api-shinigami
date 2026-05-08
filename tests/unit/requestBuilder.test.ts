import { describe, expect, it } from 'vitest';
import { buildRequest } from '../../src/core/requestBuilder.js';

describe('request builder', () => {
  it('builds JSON request with query and bearer auth', async () => {
    const request = await buildRequest({
      method: 'post',
      url: 'https://example.com/users',
      query: { page: '1' },
      json: { name: 'Ryuk' },
      auth: { type: 'bearer', token: 'secret' },
    });
    expect(request.method).toBe('POST');
    expect(request.url).toBe('https://example.com/users?page=1');
    expect(request.headers.Authorization).toBe('Bearer secret');
    expect(request.headers['content-type']).toBe('application/json');
    expect(request.body).toBe('{"name":"Ryuk"}');
  });
});
