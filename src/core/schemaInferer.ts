import { readHarRequests } from './har.js';
import { toYaml } from '../utils/yaml.js';

export interface InferredOpenApi {
  openapi: '3.0.3';
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
}

export async function inferOpenApiFromHar(filePath: string): Promise<InferredOpenApi> {
  const requests = await readHarRequests(filePath);
  const paths: Record<string, Record<string, unknown>> = {};

  for (const request of requests) {
    const parsed = new URL(request.url);
    const path = normalizePath(parsed.pathname);
    const method = request.method.toLowerCase();
    paths[path] ??= {};
    paths[path][method] = {
      summary: `${request.method.toUpperCase()} ${path}`,
      parameters: [...parsed.searchParams.keys()].map((name) => ({
        name,
        in: 'query',
        required: false,
        schema: { type: 'string' },
      })),
      responses: {
        [String(request.status ?? 200)]: {
          description: 'Observed response',
          content: {
            'application/json': {
              schema: inferSchema(request.responseBody),
            },
          },
        },
      },
    };
  }

  return {
    openapi: '3.0.3',
    info: { title: 'Inferred API', version: '1.0.0' },
    paths,
  };
}

export async function inferOpenApiYamlFromHar(filePath: string): Promise<string> {
  return toYaml(await inferOpenApiFromHar(filePath));
}

function inferSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return { type: 'array', items: inferSchema(value[0]) };
  }
  if (value === null) {
    return { nullable: true };
  }
  if (typeof value === 'object' && value) {
    return {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(value).map(([key, nested]) => [key, inferSchema(nested)]),
      ),
    };
  }
  if (typeof value === 'number') return { type: Number.isInteger(value) ? 'integer' : 'number' };
  if (typeof value === 'boolean') return { type: 'boolean' };
  return { type: 'string' };
}

function normalizePath(pathname: string): string {
  return pathname.replaceAll(/\/\d+(?=\/|$)/g, '/{id}');
}
