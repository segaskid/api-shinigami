import { ExitCode } from '../core/exitCodes.js';
import { ShinigamiError } from '../core/errors.js';

export function parseJson(input: string, label = 'JSON'): unknown {
  try {
    return JSON.parse(input) as unknown;
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Invalid JSON.';
    throw new ShinigamiError({
      code: 'INVALID_JSON',
      message: `${label} is not valid JSON.`,
      reason,
      hint: 'Check the JSON syntax and quote it correctly for your shell.',
      exitCode: ExitCode.InvalidArguments,
    });
  }
}

export function tryParseJson(input: string): unknown | undefined {
  try {
    return JSON.parse(input) as unknown;
  } catch {
    return undefined;
  }
}
