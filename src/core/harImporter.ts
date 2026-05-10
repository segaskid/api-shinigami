import { toYaml } from '../utils/yaml.js';
import { readDataFile } from '../utils/fs.js';
import type { ApiCollection, CollectionRequest } from '../types/collection.js';

export async function importHarFile(filePath: string): Promise<ApiCollection> {
  const har = asRecord(await readDataFile(filePath));
  const rawEntries = asRecord(har.log).entries;
  const entries: unknown[] = Array.isArray(rawEntries) ? rawEntries : [];
  const requests: CollectionRequest[] = entries.map((entry: unknown, index: number) => {
    const request = asRecord(asRecord(entry).request);
    const headers = Object.fromEntries(
      (Array.isArray(request.headers) ? request.headers : []).map((header) => {
        const record = asRecord(header);
        return [String(record.name), String(record.value)];
      }),
    );
    const postData = asRecord(request.postData);
    return {
      id: `har-${index + 1}`,
      name: `${String(request.method ?? 'GET')} ${String(request.url ?? '')}`,
      method: String(request.method ?? 'GET'),
      url: String(request.url ?? ''),
      headers,
      ...(postData.text ? { body: { raw: String(postData.text) } } : {}),
      assertions: [
        {
          status: Number(
            asRecord(entry).response ? asRecord(asRecord(entry).response).status : 200,
          ),
        },
      ],
    };
  });
  return { name: 'Imported HAR', version: 1, requests };
}

export async function importHarFileToYaml(filePath: string): Promise<string> {
  return toYaml(await importHarFile(filePath));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
