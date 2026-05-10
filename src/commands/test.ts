import { Command } from 'commander';
import { ExitCode } from '../core/exitCodes.js';
import { ShinigamiError } from '../core/errors.js';
import { runCollection } from '../core/collectionRunner.js';
import { saveRunReport } from '../core/reportGenerator.js';
import { loadDataRows } from '../core/dataLoader.js';
import { renderRunReport, type RunReporter } from '../core/runReporters.js';
import { formatRunSummary } from './collection.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';
import { writeTextFile } from '../utils/fs.js';
import { parseVarPairs } from '../core/variableResolver.js';

export function createTestCommand(globalOptions: () => GlobalOutputOptions): Command {
  return new Command('test')
    .description('Run focused API test suites')
    .argument('<file>', 'collection/test file')
    .option('--env <name-or-file>', 'environment name or file')
    .option('--reporter <pretty|json|md|html|junit>', 'reporter', 'pretty')
    .option('--output <file>', 'write report to file')
    .option('--bail', 'stop after first failed request')
    .option('--data <file>', 'run once per row in a JSON or CSV data file')
    .option('--var <key=value>', 'set variable', collect, [])
    .action(
      async (
        file: string,
        options: {
          env?: string;
          reporter: string;
          output?: string;
          bail?: boolean;
          data?: string;
          var?: string[];
        },
      ) => {
        const dataRows = options.data ? await loadDataRows(options.data) : undefined;
        const result = await runCollection(file, {
          env: options.env,
          vars: parseVarPairs(options.var),
          bail: options.bail,
          dataRows,
        });
        await saveRunReport('test', result);
        if (options.output) {
          await writeTextFile(
            options.output,
            renderRunReport(result, options.reporter as RunReporter),
          );
        }
        if (globalOptions().json || options.reporter === 'json')
          printJson({ ok: result.failedRequests === 0, result });
        else if (options.reporter === 'pretty') process.stdout.write(formatRunSummary(result));
        else if (!options.output)
          process.stdout.write(renderRunReport(result, options.reporter as RunReporter));
        if (result.failedRequests > 0) {
          throw new ShinigamiError({
            code: 'ASSERTION_FAILED',
            message: `${result.failedRequests} request(s) failed.`,
            exitCode: ExitCode.AssertionFailed,
          });
        }
      },
    );
}

function collect(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}
