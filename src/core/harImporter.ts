import { toYaml } from '../utils/yaml.js';
import { readHarRequests } from './har.js';
import type { ApiCollection, CollectionRequest } from '../types/collection.js';

export async function importHarFile(filePath: string): Promise<ApiCollection> {
  const requests: CollectionRequest[] = (await readHarRequests(filePath)).map((request, index) => ({
    id: `har-${index + 1}`,
    name: `${request.method} ${request.url}`,
    method: request.method,
    url: request.url,
    headers: request.headers,
    ...(request.body ? { body: { raw: request.body } } : {}),
    assertions: [{ status: request.status ?? 200 }],
  }));
  return { name: 'Imported HAR', version: 1, requests };
}

export async function importHarFileToYaml(filePath: string): Promise<string> {
  return toYaml(await importHarFile(filePath));
}
