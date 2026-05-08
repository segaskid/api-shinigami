import { describe, expect, it } from 'vitest';
import { runAssertions } from '../../src/core/assertionEngine.js';
import type { ShinigamiResponse } from '../../src/types/api.js';

const response: ShinigamiResponse = {
  status: 200,
  statusText: 'OK',
  headers: { 'content-type': 'application/json' },
  bodyText: '{"data":{"id":1,"email":"a@example.com"},"message":"success"}',
  bodyJson: { data: { id: 1, email: 'a@example.com' }, message: 'success' },
  durationMs: 42,
  sizeBytes: 64,
  redirected: false,
  url: 'http://localhost',
};

describe('assertion engine', () => {
  it('runs supported assertions', () => {
    const results = runAssertions(
      [
        { status: 200 },
        { header: { name: 'Content-Type', contains: 'json' } },
        { bodyContains: 'success' },
        { jsonPath: '$.data.id', equals: 1 },
        { jsonPath: '$.data.email', matches: '^[^@]+@[^@]+$' },
        { responseTimeLessThan: 100 },
      ],
      response,
    );
    expect(results.every((result) => result.passed)).toBe(true);
  });

  it('returns failed assertion instead of throwing', () => {
    const [result] = runAssertions([{ jsonPath: '$.missing', exists: true }], response);
    expect(result.passed).toBe(false);
  });
});
