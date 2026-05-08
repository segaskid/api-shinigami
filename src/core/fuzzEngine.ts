import { buildRequest } from './requestBuilder.js';
import { sendHttpRequest } from './httpClient.js';
import type { ShinigamiResponse } from '../types/api.js';

export type FuzzCaseCategory = 'basic' | 'strings' | 'numbers' | 'nulls' | 'security';

export interface FuzzCase {
  name: string;
  value: unknown;
}

export interface FuzzResult {
  case: FuzzCase;
  status?: number;
  durationMs?: number;
  error?: string;
}

export function generateFuzzCases(
  categories: FuzzCaseCategory[] = ['basic'],
  limit = 10,
): FuzzCase[] {
  const cases: Record<FuzzCaseCategory, FuzzCase[]> = {
    basic: [
      { name: 'empty string', value: '' },
      { name: 'null', value: null },
      { name: 'boolean', value: true },
    ],
    strings: [
      { name: 'long string', value: 'a'.repeat(2048) },
      { name: 'unicode string', value: 'こんにちは-api-shinigami' },
    ],
    numbers: [
      { name: 'zero', value: 0 },
      { name: 'negative number', value: -1 },
      { name: 'large number', value: Number.MAX_SAFE_INTEGER },
    ],
    nulls: [{ name: 'null', value: null }],
    security: [
      { name: 'sql-like string', value: "' OR '1'='1" },
      { name: 'script-like string', value: '<script>alert(1)</script>' },
      { name: 'path traversal-like string', value: '../../etc/passwd' },
    ],
  };

  return categories.flatMap((category) => cases[category] ?? []).slice(0, limit);
}

export async function runFuzz(input: {
  method: string;
  url: string;
  field?: string;
  cases: FuzzCase[];
  dryRun?: boolean;
  delayMs?: number;
}): Promise<FuzzResult[]> {
  if (input.dryRun) {
    return input.cases.map((fuzzCase) => ({ case: fuzzCase }));
  }

  const results: FuzzResult[] = [];
  for (const fuzzCase of input.cases) {
    if (input.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, input.delayMs));
    }
    try {
      const payload = input.field ? { [input.field]: fuzzCase.value } : fuzzCase.value;
      const response: ShinigamiResponse = await sendHttpRequest(
        await buildRequest({ method: input.method, url: input.url, json: payload }),
      );
      results.push({ case: fuzzCase, status: response.status, durationMs: response.durationMs });
    } catch (error) {
      results.push({
        case: fuzzCase,
        error: error instanceof Error ? error.message : 'Request failed.',
      });
    }
  }
  return results;
}
