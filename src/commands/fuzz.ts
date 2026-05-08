import { Command } from 'commander';
import { generateFuzzCases, runFuzz, type FuzzCaseCategory } from '../core/fuzzEngine.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';

export function createFuzzCommand(globalOptions: () => GlobalOutputOptions): Command {
  return new Command('fuzz')
    .description('Run safe, controlled fuzz cases against an authorized API')
    .argument('<method>')
    .argument('<url>')
    .option('--field <name>', 'JSON field to fuzz')
    .option('--cases <list>', 'case categories: basic,strings,numbers,nulls,security', 'basic')
    .option('--limit <number>', 'maximum cases', '10')
    .option('--delay <ms>', 'delay between requests')
    .option('--dry-run', 'print generated cases without sending requests')
    .action(
      async (
        method: string,
        url: string,
        options: { field?: string; cases: string; limit: string; delay?: string; dryRun?: boolean },
      ) => {
        const categories = options.cases
          .split(',')
          .map((item) => item.trim()) as FuzzCaseCategory[];
        const cases = generateFuzzCases(categories, Number(options.limit));
        const results = await runFuzz({
          method,
          url,
          field: options.field,
          cases,
          dryRun: options.dryRun,
          delayMs: options.delay ? Number(options.delay) : undefined,
        });
        if (globalOptions().json) printJson({ ok: true, authorizedUseOnly: true, results });
        else {
          process.stdout.write('Use fuzzing only on APIs you own or are authorized to test.\n');
          for (const result of results) {
            process.stdout.write(
              `${result.case.name}: ${result.status ?? result.error ?? 'dry-run'}\n`,
            );
          }
        }
      },
    );
}
