import { ExitCode } from '../core/exitCodes.js';
import { ShinigamiError } from '../core/errors.js';

export function parseHeader(input: string): [string, string] {
  const index = input.indexOf(':');
  if (index <= 0) {
    throw new ShinigamiError({
      code: 'INVALID_HEADER',
      message: `Invalid header "${input}".`,
      hint: 'Use the format --header "Name: value".',
      exitCode: ExitCode.InvalidArguments,
    });
  }
  return [input.slice(0, index).trim(), input.slice(index + 1).trim()];
}

export function normalizeHeaders(headers: Headers): Record<string, string> {
  const output: Record<string, string> = {};
  headers.forEach((value, key) => {
    output[key] = value;
  });
  return output;
}
