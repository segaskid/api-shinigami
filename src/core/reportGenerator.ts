import envPaths from 'env-paths';
import { randomUUID } from 'node:crypto';
import { nowIso } from '../utils/time.js';
import { readDataFile, writeTextFile, fileExists } from '../utils/fs.js';
import type { CollectionRunResult } from '../types/collection.js';
import type { ReportRecord } from '../types/reports.js';

const paths = envPaths('api-shinigami');
const reportsFile = `${paths.data}/reports.json`;

export async function saveRunReport(
  kind: 'collection' | 'test',
  result: CollectionRunResult,
): Promise<ReportRecord> {
  const record: ReportRecord = {
    id: randomUUID(),
    createdAt: nowIso(),
    kind,
    result,
  };
  try {
    const reports = await listReports();
    reports.unshift(record);
    await writeTextFile(reportsFile, JSON.stringify(reports.slice(0, 100), null, 2));
  } catch {
    // Report persistence is best-effort; command results still remain valid.
  }
  return record;
}

export async function listReports(): Promise<ReportRecord[]> {
  if (!(await fileExists(reportsFile))) {
    return [];
  }
  const data = await readDataFile(reportsFile);
  return Array.isArray(data) ? (data as ReportRecord[]) : [];
}

export async function latestReport(): Promise<ReportRecord | undefined> {
  return (await listReports())[0];
}

export function reportToMarkdown(report: ReportRecord): string {
  const result = report.result;
  const lines = [
    `# API Shinigami Report`,
    ``,
    `- Run ID: ${report.id}`,
    `- Created: ${report.createdAt}`,
    `- Collection: ${result.collectionName}`,
    `- Environment: ${result.environment ?? 'default'}`,
    `- Total requests: ${result.totalRequests}`,
    `- Passed: ${result.passedRequests}`,
    `- Failed: ${result.failedRequests}`,
    ``,
    `| Request | Status | Time | Assertions | Result |`,
    `| --- | ---: | ---: | ---: | --- |`,
  ];

  for (const request of result.results) {
    const passedAssertions = request.assertions.filter((assertion) => assertion.passed).length;
    lines.push(
      `| ${request.name} | ${request.status ?? 'ERR'} | ${Math.round(request.durationMs)}ms | ${passedAssertions}/${request.assertions.length} | ${request.passed ? 'PASS' : 'FAIL'} |`,
    );
  }

  return `${lines.join('\n')}\n`;
}

export function reportToHtml(report: ReportRecord): string {
  const markdown = reportToMarkdown(report)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  return `<!doctype html><html><head><meta charset="utf-8"><title>API Shinigami Report</title><style>body{font-family:system-ui;margin:2rem;line-height:1.5}pre{white-space:pre-wrap}</style></head><body><pre>${markdown}</pre></body></html>`;
}
