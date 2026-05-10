import type { CollectionRunResult } from '../types/collection.js';

export type RunReporter = 'pretty' | 'json' | 'md' | 'html' | 'junit';

export function renderRunReport(result: CollectionRunResult, reporter: RunReporter): string {
  if (reporter === 'json') {
    return `${JSON.stringify(result, null, 2)}\n`;
  }
  if (reporter === 'junit') {
    return renderJunit(result);
  }
  if (reporter === 'html') {
    return renderHtml(result);
  }
  return renderMarkdown(result);
}

export function renderMarkdown(result: CollectionRunResult): string {
  const lines = [
    `# ${result.collectionName}`,
    '',
    `- Environment: ${result.environment ?? 'default'}`,
    `- Iterations: ${result.iterations ?? 1}`,
    `- Requests: ${result.totalRequests}`,
    `- Passed: ${result.passedRequests}`,
    `- Failed: ${result.failedRequests}`,
    `- Duration: ${Math.round(result.durationMs)}ms`,
    '',
    '| Request | Status | Time | Assertions | Result |',
    '| --- | ---: | ---: | ---: | --- |',
  ];

  for (const request of result.results) {
    const passed = request.assertions.filter((assertion) => assertion.passed).length;
    lines.push(
      `| ${escapePipe(request.name)} | ${request.status ?? 'ERR'} | ${Math.round(request.durationMs)}ms | ${passed}/${request.assertions.length} | ${request.passed ? 'PASS' : 'FAIL'} |`,
    );
  }

  return `${lines.join('\n')}\n`;
}

function renderHtml(result: CollectionRunResult): string {
  const rows = result.results
    .map((request) => {
      const passed = request.assertions.filter((assertion) => assertion.passed).length;
      return `<tr class="${request.passed ? 'pass' : 'fail'}"><td>${escapeHtml(request.name)}</td><td>${request.status ?? 'ERR'}</td><td>${Math.round(request.durationMs)}ms</td><td>${passed}/${request.assertions.length}</td><td>${request.passed ? 'PASS' : 'FAIL'}</td></tr>`;
    })
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(result.collectionName)} - API Shinigami Report</title>
  <style>
    body{font-family:Inter,system-ui,sans-serif;margin:2rem;color:#151515;background:#fafafa}
    table{border-collapse:collapse;width:100%;background:white}
    th,td{border:1px solid #ddd;padding:.65rem;text-align:left}
    th{background:#111;color:white}
    .pass td:last-child{color:#0f7b3f;font-weight:700}
    .fail td:last-child{color:#b42318;font-weight:700}
  </style>
</head>
<body>
  <h1>${escapeHtml(result.collectionName)}</h1>
  <p>Environment: ${escapeHtml(result.environment ?? 'default')} | Iterations: ${result.iterations ?? 1} | Passed: ${result.passedRequests} | Failed: ${result.failedRequests}</p>
  <table><thead><tr><th>Request</th><th>Status</th><th>Time</th><th>Assertions</th><th>Result</th></tr></thead><tbody>${rows}</tbody></table>
</body>
</html>
`;
}

function renderJunit(result: CollectionRunResult): string {
  const failures = result.results.filter((request) => !request.passed).length;
  const testcases = result.results
    .map((request) => {
      const failure = request.passed
        ? ''
        : `<failure message="${escapeXml(request.error ?? 'Request failed')}">${escapeXml(
            request.assertions
              .filter((assertion) => !assertion.passed)
              .map((assertion) => assertion.message ?? assertion.name)
              .join('\n') ||
              request.error ||
              'Request failed',
          )}</failure>`;
      return `<testcase classname="${escapeXml(result.collectionName)}" name="${escapeXml(request.name)}" time="${(request.durationMs / 1000).toFixed(3)}">${failure}</testcase>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="${escapeXml(result.collectionName)}" tests="${result.results.length}" failures="${failures}" time="${(result.durationMs / 1000).toFixed(3)}">${testcases}</testsuite>
`;
}

function escapePipe(value: string): string {
  return value.replaceAll('|', '\\|');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function escapeXml(value: string): string {
  return escapeHtml(value).replaceAll("'", '&apos;');
}
