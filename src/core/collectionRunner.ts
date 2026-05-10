import { ExitCode } from './exitCodes.js';
import { ShinigamiError } from './errors.js';
import { buildRequest } from './requestBuilder.js';
import { sendHttpRequest } from './httpClient.js';
import { runAssertions } from './assertionEngine.js';
import { loadEnvironment } from './environmentManager.js';
import { resolveVariables } from './variableResolver.js';
import { validateSchema } from './schemaValidator.js';
import { nowIso } from '../utils/time.js';
import { readDataFile } from '../utils/fs.js';
import { getDotPath } from '../utils/path.js';
import type {
  ApiCollection,
  CollectionRequest,
  CollectionRunResult,
  RequestRunResult,
} from '../types/collection.js';

interface InternalRequestRunResult extends RequestRunResult {
  runtimeCaptures?: Record<string, string>;
}

export interface CollectionRunOptions {
  env?: string;
  vars?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  bail?: boolean;
  dataRows?: Record<string, string>[];
}

export async function loadCollection(filePath: string): Promise<ApiCollection> {
  const data = await readDataFile(filePath);
  return validateCollection(data, filePath);
}

export function validateCollection(data: unknown, label = 'collection'): ApiCollection {
  if (!data || typeof data !== 'object') {
    throw new ShinigamiError({
      code: 'INVALID_COLLECTION',
      message: `${label} must contain an object.`,
      exitCode: ExitCode.FileError,
    });
  }

  const collection = data as Partial<ApiCollection>;
  if (!collection.name || typeof collection.name !== 'string') {
    throw new ShinigamiError({
      code: 'INVALID_COLLECTION',
      message: `${label} is missing a string name.`,
      exitCode: ExitCode.FileError,
    });
  }
  if (!Array.isArray(collection.requests)) {
    throw new ShinigamiError({
      code: 'INVALID_COLLECTION',
      message: `${label} is missing a requests array.`,
      exitCode: ExitCode.FileError,
    });
  }

  for (const [index, request] of collection.requests.entries()) {
    if (!request.method || !request.url) {
      throw new ShinigamiError({
        code: 'INVALID_COLLECTION_REQUEST',
        message: `Request ${index + 1} must include method and url.`,
        exitCode: ExitCode.FileError,
      });
    }
  }

  return collection as ApiCollection;
}

export async function runCollection(
  filePath: string,
  options: CollectionRunOptions = {},
): Promise<CollectionRunResult> {
  const collection = await loadCollection(filePath);
  const environment = await loadEnvironment(options.env, collection.environments, options.vars);
  const startedAt = nowIso();
  const started = performance.now();
  const results: RequestRunResult[] = [];
  const dataRows = options.dataRows?.length ? options.dataRows : [{}];

  for (const [iterationIndex, dataRow] of dataRows.entries()) {
    const runtimeVariables: Record<string, string> = {
      ...environment.values,
      ...dataRow,
      $iteration: String(iterationIndex + 1),
    };
    const completed = new Map<string, RequestRunResult>();

    for (const request of collection.requests) {
      const skipped = dependencyFailure(request, completed);
      if (skipped) {
        results.push(skipped);
        completed.set(request.id ?? request.name ?? `${request.method} ${request.url}`, skipped);
        if (options.bail) break;
        continue;
      }

      const result = await runCollectionRequest(collection, request, runtimeVariables, options);
      const publicResult = toPublicResult(result);
      results.push(publicResult);
      completed.set(request.id ?? request.name ?? `${request.method} ${request.url}`, publicResult);
      Object.assign(runtimeVariables, result.runtimeCaptures ?? {});
      if (options.bail && !result.passed) {
        break;
      }
    }
  }

  const finishedAt = nowIso();
  const durationMs = performance.now() - started;
  const failedRequests = results.filter((result) => !result.passed).length;

  return {
    collectionName: collection.name,
    environment: environment.name,
    startedAt,
    finishedAt,
    durationMs,
    totalRequests: results.length,
    passedRequests: results.length - failedRequests,
    failedRequests,
    iterations: dataRows.length,
    results,
  };
}

async function runCollectionRequest(
  collection: ApiCollection,
  request: CollectionRequest,
  variables: Record<string, string>,
  options: CollectionRunOptions,
): Promise<InternalRequestRunResult> {
  const requestStarted = performance.now();
  const mergedVariables = {
    ...(collection.baseUrl ? { baseUrl: collection.baseUrl } : {}),
    ...variables,
  };
  const resolvedRequest = resolveVariables(request, { variables: mergedVariables });
  const auth = resolveVariables(
    resolvedRequest.auth ?? collection.defaults?.auth ?? collection.auth,
    {
      variables: mergedVariables,
    },
  );

  const headers = resolveVariables(
    {
      ...(collection.defaults?.headers ?? {}),
      ...(resolvedRequest.headers ?? {}),
    },
    { variables: mergedVariables },
  );
  const query = resolveVariables(
    {
      ...(collection.defaults?.query ?? {}),
      ...(resolvedRequest.query ?? {}),
    },
    { variables: mergedVariables },
  );

  try {
    const built = await buildRequest({
      method: resolvedRequest.method,
      url: resolvedRequest.url,
      headers,
      query,
      json: resolvedRequest.body?.json,
      body: resolvedRequest.body?.raw,
      form: resolvedRequest.body?.form,
      auth,
      timeoutMs: options.timeoutMs,
      retries: options.retries,
    });
    const response = await sendHttpRequest(built);
    const assertions = runAssertions(resolvedRequest.assertions ?? [], response);
    if (resolvedRequest.responseSchema) {
      const schemaResult = validateSchema(resolvedRequest.responseSchema, response.bodyJson);
      assertions.push({
        name: 'response matches schema',
        passed: schemaResult.valid,
        expected: 'valid response schema',
        actual: schemaResult.errors,
        ...(schemaResult.valid ? {} : { message: schemaResult.errors.join('; ') }),
      });
    }
    const captures = captureVariables(resolvedRequest, response);
    const passed = assertions.every((assertion) => assertion.passed);
    return {
      id: request.id,
      name: request.name ?? request.id ?? `${request.method} ${request.url}`,
      method: resolvedRequest.method,
      url: built.url,
      status: response.status,
      durationMs: response.durationMs,
      response,
      assertions,
      captures: captures.display,
      runtimeCaptures: captures.runtime,
      passed,
    };
  } catch (error) {
    return {
      id: request.id,
      name: request.name ?? request.id ?? `${request.method} ${request.url}`,
      method: request.method,
      url: request.url,
      durationMs: performance.now() - requestStarted,
      assertions: [],
      passed: false,
      error: error instanceof Error ? error.message : 'Request failed.',
    };
  }
}

function dependencyFailure(
  request: CollectionRequest,
  completed: Map<string, RequestRunResult>,
): RequestRunResult | undefined {
  const dependencies = Array.isArray(request.dependsOn)
    ? request.dependsOn
    : request.dependsOn
      ? [request.dependsOn]
      : [];
  const failedDependency = dependencies.find((dependency) => !completed.get(dependency)?.passed);
  if (!failedDependency) {
    return undefined;
  }
  return {
    id: request.id,
    name: request.name ?? request.id ?? `${request.method} ${request.url}`,
    method: request.method,
    url: request.url,
    durationMs: 0,
    assertions: [],
    passed: false,
    error: `Skipped because dependency "${failedDependency}" did not pass.`,
  };
}

function captureVariables(
  request: CollectionRequest,
  response: import('../types/api.js').ShinigamiResponse,
): { runtime: Record<string, string>; display: Record<string, string> } {
  const runtime: Record<string, string> = {};
  const display: Record<string, string> = {};
  for (const [name, config] of Object.entries(request.captures ?? {})) {
    const jsonPath = typeof config === 'string' ? config : config.jsonPath;
    const secret = typeof config === 'string' ? false : config.secret === true;
    const value = getDotPath(response.bodyJson, jsonPath);
    if (value !== undefined) {
      runtime[name] = typeof value === 'string' ? value : JSON.stringify(value);
      display[name] = secret ? '[REDACTED]' : runtime[name];
    }
  }
  return { runtime, display };
}

function toPublicResult(result: InternalRequestRunResult): RequestRunResult {
  return {
    id: result.id,
    name: result.name,
    method: result.method,
    url: result.url,
    status: result.status,
    durationMs: result.durationMs,
    response: result.response,
    assertions: result.assertions,
    captures: result.captures,
    passed: result.passed,
    error: result.error,
  };
}
