import { describe, expect, it } from 'vitest';
import { resolveVariables, resolveVariablesInString } from '../../src/core/variableResolver.js';

describe('variable resolver', () => {
  it('resolves strings and object values', () => {
    expect(
      resolveVariablesInString('{{baseUrl}}/users', { variables: { baseUrl: 'http://localhost' } }),
    ).toBe('http://localhost/users');
    expect(
      resolveVariables({ url: '{{baseUrl}}/{{$timestamp}}' }, { variables: { baseUrl: 'x' } }).url,
    ).toMatch(/^x\/\d+$/);
  });
});
