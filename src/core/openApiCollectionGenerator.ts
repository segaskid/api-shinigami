import { inspectOpenApi } from './openApiInspector.js';
import { readDataFile } from '../utils/fs.js';
import { toYaml } from '../utils/yaml.js';
import type { ApiCollection, CollectionRequest } from '../types/collection.js';

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

export async function generateCollectionFromOpenApi(source: string): Promise<ApiCollection> {
  const spec = (await readDataFile(source)) as Record<string, unknown>;
  const inspection = await inspectOpenApi(source);
  const serverUrl = inspection.servers[0] ?? 'https://api.example.com';
  const paths = asRecord(spec.paths);
  const requests: CollectionRequest[] = [];

  for (const [route, pathItem] of Object.entries(paths)) {
    for (const [method, operationValue] of Object.entries(asRecord(pathItem))) {
      if (!METHODS.has(method)) {
        continue;
      }
      const operation = asRecord(operationValue);
      const id = String(
        operation.operationId ?? `${method}-${route}`.replaceAll(/[^a-zA-Z0-9]+/g, '-'),
      );
      requests.push({
        id,
        name: String(operation.summary ?? `${method.toUpperCase()} ${route}`),
        method: method.toUpperCase(),
        url: `{{baseUrl}}${route.replaceAll(/{([^}]+)}/g, '{{$1}')}`,
        assertions: [{ status: firstSuccessStatus(operation) }],
      });
    }
  }

  return {
    name: inspection.title,
    version: inspection.version,
    baseUrl: '{{baseUrl}}',
    environments: {
      local: {
        baseUrl: serverUrl,
      },
    },
    defaults: {
      headers: {
        Accept: 'application/json',
      },
    },
    requests,
  };
}

export async function generateCollectionYamlFromOpenApi(source: string): Promise<string> {
  return toYaml(await generateCollectionFromOpenApi(source));
}

function firstSuccessStatus(operation: Record<string, unknown>): number {
  const responses = asRecord(operation.responses);
  const status = Object.keys(responses).find((key) => key.startsWith('2'));
  return status ? Number(status) : 200;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
