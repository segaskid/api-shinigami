import { Command } from 'commander';
import Table from 'cli-table3';
import { ExitCode } from '../core/exitCodes.js';
import { ShinigamiError } from '../core/errors.js';
import { loadCollection, runCollection, validateCollection } from '../core/collectionRunner.js';
import { saveRunReport } from '../core/reportGenerator.js';
import { renderRunReport, type RunReporter } from '../core/runReporters.js';
import { loadDataRows } from '../core/dataLoader.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';
import { writeTextFile } from '../utils/fs.js';
import { parseVarPairs } from '../core/variableResolver.js';

interface CollectionOptions extends GlobalOutputOptions {
  env?: string;
  var?: string[];
  timeout?: string;
  retries?: string;
  output?: string;
  reporter?: string;
  data?: string;
}

export function createCollectionCommand(globalOptions: () => GlobalOutputOptions): Command {
  const command = new Command('collection').description('Manage and run API collections');

  command
    .command('run')
    .argument('<file>', 'collection YAML or JSON file')
    .option('--env <name-or-file>', 'environment name or file')
    .option('--var <key=value>', 'set variable', collect, [])
    .option('--timeout <ms>', 'request timeout')
    .option('--retries <number>', 'request retries')
    .option('--data <file>', 'run once per row in a JSON or CSV data file')
    .option('--reporter <pretty|json|md|html|junit>', 'reporter for terminal output or --output', 'pretty')
    .option('--output <file>', 'write run result JSON')
    .action(async (file: string, options: CollectionOptions) => {
      const dataRows = options.data ? await loadDataRows(options.data) : undefined;
      const result = await runCollection(file, {
        env: options.env,
        vars: parseVarPairs(options.var),
        timeoutMs: options.timeout ? Number(options.timeout) : undefined,
        retries: options.retries ? Number(options.retries) : undefined,
        dataRows,
      });
      await saveRunReport('collection', result);
      if (options.output) {
        await writeTextFile(
          options.output,
          renderRunReport(result, options.reporter as RunReporter),
        );
      }
      if (globalOptions().json) {
        printJson({ ok: result.failedRequests === 0, result });
      } else if (!globalOptions().quiet && options.reporter && options.reporter !== 'pretty' && !options.output) {
        process.stdout.write(renderRunReport(result, options.reporter as RunReporter));
      } else if (!globalOptions().quiet) {
        process.stdout.write(formatRunSummary(result));
      }
      if (result.failedRequests > 0) {
        throw new ShinigamiError({
          code: 'ASSERTION_FAILED',
          message: `${result.failedRequests} request(s) failed.`,
          hint: 'Review the failed request rows and assertion messages above.',
          exitCode: ExitCode.AssertionFailed,
        });
      }
    });

  command
    .command('validate')
    .argument('<file>', 'collection YAML or JSON file')
    .action(async (file: string) => {
      const collection = await loadCollection(file);
      validateCollection(collection, file);
      if (globalOptions().json) {
        printJson({ ok: true, collection: collection.name, requests: collection.requests.length });
      } else {
        process.stdout.write(
          `Collection "${collection.name}" is valid (${collection.requests.length} requests).\n`,
        );
      }
    });

  command.command('list').action(() => {
    const payload = { ok: true, collections: [] as string[] };
    if (globalOptions().json) printJson(payload);
    else process.stdout.write('No collection registry yet. Use plain YAML/JSON files directly.\n');
  });

  command
    .command('new')
    .argument('<name>')
    .action(async (name: string) => {
      const file = `${name.replaceAll(/\s+/g, '-').toLowerCase()}.collection.yml`;
      await writeTextFile(
        file,
        `name: ${name}\nversion: 1\nrequests:\n  - id: health\n    name: Health\n    method: GET\n    url: "https://example.com"\n    assertions:\n      - status: 200\n`,
      );
      if (globalOptions().json) printJson({ ok: true, file });
      else process.stdout.write(`Created ${file}\n`);
    });

  command
    .command('export')
    .argument('<file>')
    .action((file: string) => {
      if (globalOptions().json) printJson({ ok: true, file });
      else process.stdout.write(`Collections are already portable files: ${file}\n`);
    });

  return command;
}

export function formatRunSummary(
  result: import('../types/collection.js').CollectionRunResult,
): string {
  const table = new Table({
    head: ['Request', 'Status', 'Time', 'Tests', 'Result'],
    wordWrap: true,
  });
  for (const row of result.results) {
    const passed = row.assertions.filter((assertion) => assertion.passed).length;
    table.push([
      row.name,
      row.status ?? 'ERR',
      `${Math.round(row.durationMs)}ms`,
      `${passed}/${row.assertions.length}`,
      row.passed ? 'PASS' : 'FAIL',
    ]);
  }
  return [
    `Collection: ${result.collectionName}`,
    `Environment: ${result.environment ?? 'default'}`,
    '',
    table.toString(),
    '',
    `Passed: ${result.passedRequests}`,
    `Failed: ${result.failedRequests}`,
    '',
  ].join('\n');
}

function collect(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}
