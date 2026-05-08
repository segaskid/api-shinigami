const SECRET_KEY_PATTERNS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'api-key',
  'apikey',
  'token',
  'access_token',
  'refresh_token',
  'password',
  'secret',
  'client_secret',
  'private_key',
];

const REDACTED = '[REDACTED]';

export function isSecretKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SECRET_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

export function redactValue(key: string, value: string): string {
  if (!isSecretKey(key)) {
    return value;
  }

  if (key.toLowerCase() === 'authorization' && value.toLowerCase().startsWith('bearer ')) {
    return `Bearer ${REDACTED}`;
  }

  if (key.toLowerCase() === 'authorization' && value.toLowerCase().startsWith('basic ')) {
    return `Basic ${REDACTED}`;
  }

  return REDACTED;
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key, redactValue(key, value)]),
  );
}

export function redactObject<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactObject(item)) as T;
  }

  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      if (isSecretKey(key)) {
        output[key] = REDACTED;
      } else {
        output[key] = redactObject(nested);
      }
    }
    return output as T;
  }

  return value;
}
