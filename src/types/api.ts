export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS' | string;

export interface AuthConfig {
  type: 'bearer' | 'basic' | 'api-key';
  token?: string;
  username?: string;
  password?: string;
  name?: string;
  value?: string;
  in?: 'header' | 'query';
}

export interface RequestInput {
  method: HttpMethod;
  url: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  json?: unknown;
  body?: string;
  form?: Record<string, string>;
  auth?: AuthConfig;
  timeoutMs?: number;
  retries?: number;
  followRedirects?: boolean;
}

export interface BuiltRequest {
  method: HttpMethod;
  url: string;
  headers: Record<string, string>;
  body?: string;
  timeoutMs: number;
  retries: number;
  followRedirects: boolean;
}

export interface ShinigamiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bodyText: string;
  bodyJson?: unknown;
  durationMs: number;
  sizeBytes: number;
  redirected: boolean;
  url: string;
}
