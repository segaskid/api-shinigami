import { buildRequest } from './requestBuilder.js';
import { sendHttpRequest } from './httpClient.js';
import { readHarRequests } from './har.js';

export interface ReplayResult {
  total: number;
  passed: number;
  failed: number;
  results: {
    method: string;
    url: string;
    expectedStatus?: number;
    actualStatus?: number;
    passed: boolean;
    error?: string;
  }[];
}

export async function replayHar(input: { file: string; target?: string }): Promise<ReplayResult> {
  const results: ReplayResult['results'] = [];
  for (const request of await readHarRequests(input.file)) {
    const url = input.target ? rewriteTarget(request.url, input.target) : request.url;
    try {
      const response = await sendHttpRequest(
        await buildRequest({
          method: request.method,
          url,
          headers: request.headers,
          body: request.body,
        }),
      );
      results.push({
        method: request.method,
        url,
        expectedStatus: request.status,
        actualStatus: response.status,
        passed: request.status === undefined || request.status === response.status,
      });
    } catch (error) {
      results.push({
        method: request.method,
        url,
        expectedStatus: request.status,
        passed: false,
        error: error instanceof Error ? error.message : 'Replay failed.',
      });
    }
  }
  const failed = results.filter((result) => !result.passed).length;
  return { total: results.length, passed: results.length - failed, failed, results };
}

function rewriteTarget(url: string, target: string): string {
  const source = new URL(url);
  const destination = new URL(target);
  destination.pathname = source.pathname;
  destination.search = source.search;
  return destination.toString();
}
