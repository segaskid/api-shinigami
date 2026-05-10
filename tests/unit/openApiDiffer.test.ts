import { describe, expect, it } from 'vitest';
import { diffOpenApi } from '../../src/core/openApiDiffer.js';

describe('openapi differ', () => {
  it('reports removed operations and new required request fields as breaking', () => {
    const before = {
      paths: {
        '/users': {
          get: { responses: { '200': { description: 'OK' } } },
          post: {
            requestBody: {
              content: {
                'application/json': { schema: { type: 'object', required: ['name'] } },
              },
            },
            responses: { '201': { description: 'Created' } },
          },
        },
      },
    };
    const after = {
      paths: {
        '/users': {
          post: {
            requestBody: {
              content: {
                'application/json': { schema: { type: 'object', required: ['name', 'email'] } },
              },
            },
            responses: { '201': { description: 'Created' } },
          },
        },
      },
    };

    const diff = diffOpenApi(before, after);
    expect(diff.ok).toBe(false);
    expect(diff.breaking).toContain('Removed operation GET /users');
    expect(diff.breaking).toContain('New required request field email in POST /users');
  });
});
