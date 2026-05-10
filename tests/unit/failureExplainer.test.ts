import { describe, expect, it } from 'vitest';
import { explainFailure } from '../../src/core/failureExplainer.js';

describe('failure explainer', () => {
  it('classifies common failure modes', () => {
    expect(explainFailure('ETIMEDOUT after 5000ms').category).toBe('Timeout');
    expect(explainFailure({ status: 401 }).category).toBe('Authentication failure');
    expect(explainFailure('<html>login</html>').category).toBe('Unexpected HTML response');
  });
});
