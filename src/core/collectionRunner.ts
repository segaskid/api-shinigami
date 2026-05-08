import { ExitCode } from './exitCodes.js';
import { ShinigamiError } from './errors.js';
import { buildRequest } from './requestBuilder.js';
import { sendHttpRequest } from './httpClient.js';
import { runAssertions } from './assertionEngine.js';
import { loadEnvironment } from './environmentManager.js';
import { resolveVariables } from './variableResolver.js';
import { nowIso } from '../utils/time.js';
import { readDataFile } from '../utils/fs.js';
import type {
  ApiCollection,
  CollectionRequest,
  CollectionRunResult,
  RequestRunResult,
} from '../types/collection.js';

export interface CollectionRunOptions {
  env?: string;
  vars?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  bail?: boolean;
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

  for (const request of collection.requests) {
    const result = await runCollectionRequest(collection, request, environment.values, options);
    results.push(result);
    if (options.bail && !result.passed) {
      break;
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
    results,
  };
}

async function runCollectionRequest(
  collection: ApiCollection,
  request: CollectionRequest,
  variables: Record<string, string>,
  options: CollectionRunOptions,
): Promise<RequestRunResult> {
  const requestStarted = performance.now();
  const mergedVariables = {
    ...(collection.baseUrl ? { baseUrl: collection.baseUrl } : {}),
    ...variables,
  };
  const resolvedRequest = resolveVariables(request, { variables: mergedVariables });
  const auth = resolveVariables(resolvedRequest.auth ?? collection.auth, {
    variables: mergedVariables,
  });

  try {
    const built = await buildRequest({
      method: resolvedRequest.method,
      url: resolvedRequest.url,
      headers: resolvedRequest.headers,
      query: resolvedRequest.query,
      json: resolvedRequest.body?.json,
      body: resolvedRequest.body?.raw,
      form: resolvedRequest.body?.form,
      auth,
      timeoutMs: options.timeoutMs,
      retries: options.retries,
    });
    const response = await sendHttpRequest(built);
    const assertions = runAssertions(resolvedRequest.assertions ?? [], response);
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
