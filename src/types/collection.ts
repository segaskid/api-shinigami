import type { Assertion } from './assertions.js';
import type { AuthConfig, HttpMethod, ShinigamiResponse } from './api.js';

export interface CollectionEnvironment {
  [key: string]: string | number | boolean | undefined;
}

export interface CollectionBody {
  json?: unknown;
  raw?: string;
  form?: Record<string, string>;
}

export interface CollectionRequest {
  id?: string;
  name?: string;
  dependsOn?: string | string[];
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: CollectionBody;
  auth?: AuthConfig;
  captures?: Record<string, string | { jsonPath: string; secret?: boolean }>;
  responseSchema?: unknown;
  assertions?: Assertion[];
}

export interface ApiCollection {
  name: string;
  version?: number | string;
  baseUrl?: string;
  defaults?: {
    headers?: Record<string, string>;
    query?: Record<string, string>;
    auth?: AuthConfig;
  };
  auth?: AuthConfig;
  environments?: Record<string, CollectionEnvironment>;
  requests: CollectionRequest[];
}

export interface RequestRunResult {
  id?: string;
  name: string;
  method: string;
  url: string;
  status?: number;
  durationMs: number;
  response?: ShinigamiResponse;
  assertions: import('./assertions.js').AssertionResult[];
  captures?: Record<string, string>;
  passed: boolean;
  error?: string;
}

export interface CollectionRunResult {
  collectionName: string;
  environment?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totalRequests: number;
  passedRequests: number;
  failedRequests: number;
  iterations?: number;
  results: RequestRunResult[];
}
