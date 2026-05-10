import { describe, expect, it } from 'vitest';
import { generateCollectionFromOpenApi } from '../../src/core/openApiCollectionGenerator.js';

describe('openapi collection generator', () => {
  it('generates requests from an OpenAPI file', async () => {
    const collection = await generateCollectionFromOpenApi('examples/openapi-example.json');
    expect(collection.name).toBe('Example API');
    expect(collection.environments?.local?.baseUrl).toBe('https://api.example.com');
    expect(collection.requests[0]).toMatchObject({
      method: 'GET',
      url: '{{baseUrl}}/users',
    });
  });
});
