import { Buffer } from 'node:buffer';
import { ExitCode } from './exitCodes.js';
import { ShinigamiError } from './errors.js';
import type { AuthConfig } from '../types/api.js';

export function parseInlineAuth(value: string): AuthConfig {
  const index = value.indexOf(':');
  if (index <= 0) {
    throw new ShinigamiError({
      code: 'INVALID_AUTH',
      message: `Invalid auth value "${value}".`,
      hint: 'Use bearer:token, basic:username:password, or api-key:name:value.',
      exitCode: ExitCode.AuthError,
    });
  }

  const type = value.slice(0, index);
  const rest = value.slice(index + 1);
  if (type === 'bearer') {
    return { type: 'bearer', token: rest };
  }
  if (type === 'basic') {
    const [username, ...passwordParts] = rest.split(':');
    return { type: 'basic', username, password: passwordParts.join(':') };
  }
  if (type === 'api-key') {
    const [name, ...valueParts] = rest.split(':');
    return { type: 'api-key', name, value: valueParts.join(':'), in: 'header' };
  }

  throw new ShinigamiError({
    code: 'INVALID_AUTH',
    message: `Unsupported auth type "${type}".`,
    hint: 'Supported auth types are bearer, basic, and api-key.',
    exitCode: ExitCode.AuthError,
  });
}

export function basicToken(username: string, password: string): string {
  return Buffer.from(`${username}:${password}`).toString('base64');
}
