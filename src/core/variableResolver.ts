import { uuid } from '../utils/crypto.js';

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

  const env = input.processEnv?.[key] ?? process.env[key];
  return env === undefined ? undefined : String(env);
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
