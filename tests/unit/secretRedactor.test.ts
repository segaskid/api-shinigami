import { describe, expect, it } from 'vitest';
import { redactHeaders, redactObject, redactValue } from '../../src/core/secretRedactor.js';

describe('secret redaction', () => {
  it('redacts sensitive headers', () => {
    expect(redactValue('Authorization', 'Bearer abc')).toBe('Bearer [REDACTED]');
    expect(redactHeaders({ 'X-API-Key': 'secret', Accept: 'application/json' })).toEqual({
      'X-API-Key': '[REDACTED]',
      Accept: 'application/json',
    });
  });

  it('redacts nested secret keys', () => {
    expect(redactObject({ token: 'abc', nested: { password: 'pw', ok: true } })).toEqual({
      token: '[REDACTED]',
      nested: { password: '[REDACTED]', ok: true },
    });
  });
});
