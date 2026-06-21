import { uuid } from '../utils/crypto.js';

// Allowed environment variables that can be accessed via template syntax
// This prevents accidental exposure of sensitive environment variables
const ALLOWED_ENV_PREFIXES = [
  'SHINIGAMI_',
  'NODE_',
  'PATH',
  'HOME',
  'USER',
  'USERNAME',
  'TERM',
  'LANG',
  'LC_',
];

const BLOCKED_ENV_PATTERNS = [
  /PASSWORD/i,
  /SECRET/i,
  /TOKEN/i,
  /KEY/i,
  /CREDENTIAL/i,
  /PRIVATE/i,
  /AWS_/i,
  /AZURE_/i,
  /GCP_/i,
  /GOOGLE_/i,
  /SSH_/i,
  /GPG_/i,
  /API_KEY/i,
  /APIKEY/i,
  /DB_/i,
  /DATABASE_/i,
  /REDIS_/i,
  /MONGO_/i,
  /MYSQL_/i,
  /POSTGRES_/i,
];

function isEnvVarAllowed(key: string): boolean {
  // Check if variable name contains blocked patterns
  for (const pattern of BLOCKED_ENV_PATTERNS) {
    if (pattern.test(key)) {
      return false;
    }
  }

  // Check if variable starts with allowed prefixes
  for (const prefix of ALLOWED_ENV_PREFIXES) {
    if (key.startsWith(prefix)) {
      return true;
    }
  }

  // Default deny for any other environment variables
  return false;
}

export interface VariableResolverInput {
  variables?: Record<string, unknown>;
  processEnv?: NodeJS.ProcessEnv;
}

export function resolveVariablesInString(value: string, input: VariableResolverInput = {}): string {
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key: string) => {
    const trimmed = key.trim();
    const resolved = resolveVariable(trimmed, input);
    return resolved === undefined ? `{{${trimmed}}}` : resolved;
  });
}

export function resolveVariables<T>(value: T, input: VariableResolverInput = {}): T {
  if (typeof value === 'string') {
    return resolveVariablesInString(value, input) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveVariables(item, input)) as T;
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      output[key] = resolveVariables(nested, input);
    }
    return output as T;
  }

  return value;
}

function resolveVariable(key: string, input: VariableResolverInput): string | undefined {
  if (key === '$timestamp') {
    return String(Date.now());
  }
  if (key === '$uuid') {
    return uuid();
  }
  if (key === '$randomInt') {
    return String(Math.floor(Math.random() * 10_000));
  }

  const direct = input.variables?.[key];
  if (direct !== undefined) {
    return String(direct);
  }

  // Check environment variable access
  const envValue = input.processEnv?.[key] ?? process.env[key];
  if (envValue === undefined) {
    return undefined;
  }

  // Validate that the environment variable is allowed to be accessed
  if (!isEnvVarAllowed(key)) {
    // Silently ignore disallowed environment variables for security
    return undefined;
  }

  return String(envValue);
}

export function parseVarPairs(pairs: string[] = []): Record<string, string> {
  const output: Record<string, string> = {};
  for (const pair of pairs) {
    const index = pair.indexOf('=');
    if (index <= 0) {
      throw new Error(`Invalid variable "${pair}". Use key=value.`);
    }
    output[pair.slice(0, index)] = pair.slice(index + 1);
  }
  return output;
}
