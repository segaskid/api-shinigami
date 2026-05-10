import { Command } from 'commander';
import Table from 'cli-table3';
import { sniffPageEndpoints, sniffResultToCollectionYaml } from '../core/apiSniffer.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';
import { writeTextFile } from '../utils/fs.js';

export function createSniffCommand(globalOptions: () => GlobalOutputOptions): Command {
  return new Command('sniff')
    .description('Discover API endpoints referenced by a web page and its assets')
    .argument('<url>', 'page URL to inspect')
    .option('--max-assets <number>', 'maximum same-origin JS/CSS assets to scan', '20')
    .option('--include-external', 'scan external JS/CSS assets too')
    .option('--browser', 'capture runtime fetch/XHR requests with Playwright if installed')
    .option('--timeout <ms>', 'request timeout in milliseconds')
    .option('--collection <file>', 'write discovered endpoints as a collection')
    .option('--format <table|json>', 'terminal output format', 'table')
    .action(
      async (
        url: string,
        options: {
          maxAssets: string;
          includeExternal?: boolean;
          browser?: boolean;
          timeout?: string;
          collection?: string;
          format: 'table' | 'json';
        },
      ) => {
        const result = await sniffPageEndpoints(url, {
          maxAssets: Number(options.maxAssets),
          includeExternal: options.includeExternal,
          browser: options.browser,
          timeoutMs: options.timeout ? Number(options.timeout) : undefined,
        });

        if (options.collection) {
          await writeTextFile(options.collection, sniffResultToCollectionYaml(result));
        }

        if (globalOptions().json || options.format === 'json') {
          printJson({ ok: true, result });
        } else {
          process.stdout.write(formatSniffResult(result));
        }
      },
    );
}

function formatSniffResult(result: Awaited<ReturnType<typeof sniffPageEndpoints>>): string {
  const table = new Table({ head: ['Method', 'Endpoint', 'Kind', 'Source'], wordWrap: true });
  for (const endpoint of result.endpoints) {
    table.push([endpoint.method, endpoint.url, endpoint.kind, endpoint.source]);
  }
  return [
    `Page: ${result.pageUrl}`,
    `Assets scanned: ${result.scannedAssets.length}`,
    `Endpoints found: ${result.endpoints.length}`,
    '',
    table.toString(),
    '',
    ...result.notes.map((note) => `Note: ${note}`),
    '',
  ].join('\n');
}
