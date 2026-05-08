export function nowIso(): string {
  return new Date().toISOString();
}

export function formatDuration(ms: number): string {
  return `${Math.round(ms)}ms`;
}
