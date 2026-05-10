export function getDotPath(value: unknown, path: string): unknown {
  const normalized = path.replace(/^\$\.?/, '');
  if (!normalized) {
    return value;
  }

  return normalized.split('.').reduce<unknown>((current, segment) => {
    if (current === undefined || current === null) {
      return undefined;
    }
    if (/^\d+$/.test(segment) && Array.isArray(current)) {
      return current[Number(segment)];
    }
    if (typeof current === 'object' && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, value);
}
