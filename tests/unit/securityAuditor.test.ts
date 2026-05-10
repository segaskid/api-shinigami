import { describe, expect, it } from 'vitest';
import { auditOpenApi } from '../../src/core/securityAuditor.js';

describe('security auditor', () => {
  it('flags insecure servers and sensitive unauthenticated endpoints', () => {
    const result = auditOpenApi({
      servers: [{ url: 'http://api.example.com' }],
      paths: {
        '/admin/users': {
          get: {
            responses: {
              '200': {
                description: 'OK',
                content: {
                  'application/json': { schema: { properties: { token: { type: 'string' } } } },
                },
              },
            },
          },
        },
      },
    });
    expect(result.ok).toBe(false);
    expect(result.findings.some((finding) => finding.message.includes('insecure HTTP'))).toBe(true);
    expect(result.findings.some((finding) => finding.message.includes('no declared auth'))).toBe(
      true,
    );
  });
});
