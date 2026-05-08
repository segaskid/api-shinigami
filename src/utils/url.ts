import { ExitCode } from '../core/exitCodes.js';
import { ShinigamiError } from '../core/errors.js';

export function appendQueryParams(url: string, query: Record<string, string>): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ShinigamiError({
      code: 'INVALID_URL',
      message: `Invalid URL "${url}".`,
      hint: 'Use an absolute URL such as https://api.example.com/users.',
      exitCode: ExitCode.InvalidArguments,
    });
  }

  for (const [key, value] of Object.entries(query)) {
    parsed.searchParams.append(key, value);
  }

  return parsed.toString();
}
