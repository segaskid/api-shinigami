import { parse, stringify } from 'yaml';
import { ExitCode } from '../core/exitCodes.js';
import { ShinigamiError } from '../core/errors.js';

export function parseYaml(input: string, label = 'YAML'): unknown {
  try {
    return parse(input) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Invalid YAML.';
    throw new ShinigamiError({
      code: 'INVALID_YAML',
      message: `${label} is not valid YAML.`,
      reason,
      hint: 'Check indentation, quotes, and mapping syntax.',
      exitCode: ExitCode.FileError,
    });
  }
}

export function toYaml(value: unknown): string {
  return stringify(value);
}
