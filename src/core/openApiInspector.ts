import { sendHttpRequest } from './httpClient.js';
import { buildRequest } from './requestBuilder.js';
import { readDataFile } from '../utils/fs.js';
import { parseJson } from '../utils/json.js';
import { parseYaml } from '../utils/yaml.js';

export interface OpenApiInspection {
  title: string;
  version: string;
  servers: string[];
  endpointCount: number;
  methodCounts: Record<string, number>;
  tags: string[];
  warnings: string[];
}

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

export async function inspectOpenApi(source: string): Promise<OpenApiInspection> {
  const spec = await loadSpec(source);
  const root = spec as Record<string, unknown>;
  const info = asRecord(root.info);
  const paths = asRecord(root.paths);
  const methodCounts: Record<string, number> = {};
  const tags = new Set<string>();
  const warnings: string[] = [];
  let endpointCount = 0;

  for (const [path, pathItem] of Object.entries(paths)) {
    const operations = asRecord(pathItem);
    for (const [method, operationValue] of Object.entries(operations)) {
      if (!METHODS.has(method)) {
        continue;
      }
      endpointCount += 1;
      methodCounts[method.toUpperCase()] = (methodCounts[method.toUpperCase()] ?? 0) + 1;
      const operation = asRecord(operationValue);
      for (const tag of Array.isArray(operation.tags) ? operation.tags : []) {
        tags.add(String(tag));
      }
      if (!operation.summary) warnings.push(`${method.toUpperCase()} ${path} missing summary`);
      if (!operation.description)
        warnings.push(`${method.toUpperCase()} ${path} missing description`);
      if (!operation.operationId)
        warnings.push(`${method.toUpperCase()} ${path} missing operationId`);
      if (!hasResponseSchema(operation))
        warnings.push(`${method.toUpperCase()} ${path} missing response schema`);
    }
  }

  return {
    title: String(info.title ?? 'Untitled API'),
    version: String(info.version ?? 'unknown'),
    servers: extractServers(root.servers),
    endpointCount,
    methodCounts,
    tags: [...tags].sort(),
    warnings,
  };
}

async function loadSpec(source: string): Promise<unknown> {
  if (source.startsWith('http://') || source.startsWith('https://')) {
    const response = await sendHttpRequest(await buildRequest({ method: 'GET', url: source }));
    return response.bodyJson ?? parseYaml(response.bodyText, source);
  }
  return readDataFile(source);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function extractServers(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((server) => String(asRecord(server).url ?? '')).filter(Boolean);
}

function hasResponseSchema(operation: Record<string, unknown>): boolean {
  const responses = asRecord(operation.responses);
  return Object.values(responses).some((response) => {
    const content = asRecord(asRecord(response).content);
    return Object.values(content).some((media) => asRecord(media).schema !== undefined);
  });
}

export function parseOpenApiText(text: string, label: string): unknown {
  return label.endsWith('.json') ? parseJson(text, label) : parseYaml(text, label);
}
