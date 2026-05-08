import { describe, expect, it } from 'vitest';
import { validateCollection } from '../../src/core/collectionRunner.js';

describe('collection validation', () => {
  it('accepts a minimal valid collection', () => {
    const collection = validateCollection({
      name: 'Demo',
      requests: [{ method: 'GET', url: 'https://example.com' }],
    });
    expect(collection.name).toBe('Demo');
  });

  it('rejects invalid collections', () => {
    expect(() => validateCollection({ name: 'Bad' })).toThrow(/requests array/);
  });
});
