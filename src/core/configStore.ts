import envPaths from 'env-paths';
import { readDataFile, writeTextFile, fileExists } from '../utils/fs.js';
import type { ShinigamiConfig } from '../types/config.js';

const paths = envPaths('api-shinigami');
const configFile = `${paths.config}/config.json`;

export const defaultConfig: ShinigamiConfig = {
  defaultTimeout: 30_000,
  defaultRetries: 0,
  color: true,
  history: {
    enabled: true,
    maxEntries: 100,
  },
  redaction: {
    enabled: true,
  },
};

export async function loadConfig(): Promise<ShinigamiConfig> {
  if (!(await fileExists(configFile))) {
    return defaultConfig;
  }
  const data = (await readDataFile(configFile)) as Partial<ShinigamiConfig>;
  return { ...defaultConfig, ...data };
}

export async function saveConfig(config: ShinigamiConfig): Promise<void> {
  await writeTextFile(configFile, JSON.stringify(config, null, 2));
}

export function getConfigValue(config: ShinigamiConfig, key: string): unknown {
  return key.split('.').reduce<unknown>((current, part) => {
    if (current && typeof current === 'object' && part in current) {
      return (current as Record<string, unknown>)[part];
    }
    return undefined;
  }, config);
}

export function setConfigValue(
  config: ShinigamiConfig,
  key: string,
  value: string,
): ShinigamiConfig {
  const clone = structuredClone(config) as unknown as Record<string, unknown>;
  const parts = key.split('.');
  let cursor = clone;
  for (const part of parts.slice(0, -1)) {
    const nested = cursor[part];
    if (!nested || typeof nested !== 'object') {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts.at(-1) ?? key] = coerceValue(value);
  return clone as unknown as ShinigamiConfig;
}

function coerceValue(value: string): string | number | boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const number = Number(value);
  return Number.isFinite(number) && value.trim() !== '' ? number : value;
}
