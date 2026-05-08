import { ExitCode } from './exitCodes.js';
import { ShinigamiError } from './errors.js';
import { readDataFile } from '../utils/fs.js';
import type { CollectionEnvironment } from '../types/collection.js';
import type { EnvironmentFile, ResolvedEnvironment } from '../types/environment.js';

export async function loadEnvironment(
  envNameOrFile: string | undefined,
  collectionEnvironments: Record<string, CollectionEnvironment> | undefined,
  cliVars: Record<string, string> = {},
): Promise<ResolvedEnvironment> {
  const values: Record<string, string> = {};
  const secretKeys = new Set<string>();
  let name = envNameOrFile;

  if (envNameOrFile) {
    if (looksLikeFile(envNameOrFile)) {
      const data = (await readDataFile(envNameOrFile)) as EnvironmentFile;
      name = data.name ?? envNameOrFile;
      for (const [key, value] of Object.entries(data.variables ?? {})) {
        values[key] = String(value);
      }
      for (const [key, value] of Object.entries(data.secrets ?? {})) {
        secretKeys.add(key);
        values[key] = resolveSecretValue(value);
      }
    } else if (collectionEnvironments?.[envNameOrFile]) {
      for (const [key, value] of Object.entries(collectionEnvironments[envNameOrFile])) {
        if (value !== undefined) {
          values[key] = String(value);
        }
      }
    } else if (collectionEnvironments) {
      throw new ShinigamiError({
        code: 'ENVIRONMENT_NOT_FOUND',
        message: `Environment "${envNameOrFile}" was not found in the collection.`,
        hint: `Use one of: ${Object.keys(collectionEnvironments).join(', ') || '(none)'}.`,
        exitCode: ExitCode.ConfigError,
      });
    }
  }

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && values[key] === undefined) {
      values[key] = value;
    }
  }

  Object.assign(values, cliVars);
  return { name, values, secretKeys };
}

function looksLikeFile(value: string): boolean {
  return (
    value.endsWith('.yml') ||
    value.endsWith('.yaml') ||
    value.endsWith('.json') ||
    value.includes('/')
  );
}

function resolveSecretValue(value: string): string {
  if (value.startsWith('env:')) {
    return process.env[value.slice(4)] ?? '';
  }
  return value;
}
