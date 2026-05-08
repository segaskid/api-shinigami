import chalk from 'chalk';
import Table from 'cli-table3';
import { redactHeaders } from './secretRedactor.js';
import type { BuiltRequest, ShinigamiResponse } from '../types/api.js';

export interface FormattedResponse {
  ok: boolean;
  request: {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
  response: ShinigamiResponse;
}

export function toResponseJson(
  request: BuiltRequest,
  response: ShinigamiResponse,
): FormattedResponse {
  return {
    ok: true,
    request: {
      method: request.method,
      url: request.url,
      headers: redactHeaders(request.headers),
    },
    response: {
      ...response,
      headers: redactHeaders(response.headers),
    },
  };
}

export function formatResponseHuman(request: BuiltRequest, response: ShinigamiResponse): string {
  const statusColor =
    response.status >= 400 ? chalk.red : response.status >= 300 ? chalk.yellow : chalk.green;
  const lines = [
    chalk.cyan('API Shinigami ⛩'),
    '',
    `${chalk.bold(request.method)} ${request.url}`,
    `Status: ${statusColor(`${response.status} ${response.statusText}`)}`,
    `Time:   ${Math.round(response.durationMs)}ms`,
    `Size:   ${formatBytes(response.sizeBytes)}`,
    '',
  ];

  const headers = redactHeaders(response.headers);
  if (Object.keys(headers).length > 0) {
    const table = new Table({ head: ['Header', 'Value'], wordWrap: true });
    for (const [key, value] of Object.entries(headers)) {
      table.push([key, value]);
    }
    lines.push(chalk.bold('Headers'), table.toString(), '');
  }

  lines.push(chalk.bold('Body'));
  if (response.bodyJson !== undefined) {
    lines.push(JSON.stringify(response.bodyJson, null, 2));
  } else {
    lines.push(response.bodyText);
  }

  return `${lines.join('\n')}\n`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}
