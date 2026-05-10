import { describe, expect, it } from 'vitest';
import {
  importCurl,
  importedCurlToCollectionYaml,
  importedCurlToShinigamiCommand,
} from '../../src/core/curlImporter.js';

describe('curl importer', () => {
  it('imports curl headers, method, URL, and JSON body', () => {
    const request = importCurl(
      `curl -X POST https://api.example.com/users -H 'Authorization: Bearer token' -H 'Content-Type: application/json' --data-raw '{"name":"Light"}'`,
    );
    expect(request).toEqual({
      method: 'POST',
      url: 'https://api.example.com/users',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
      body: '{"name":"Light"}',
    });
    expect(importedCurlToShinigamiCommand(request)).toContain('shinigami request POST');
    expect(importedCurlToCollectionYaml(request)).toContain('name: Light');
  });
});
