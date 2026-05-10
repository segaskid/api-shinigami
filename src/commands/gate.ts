import { Command } from 'commander';
import { runGate } from '../core/gateRunner.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';

export function createGateCommand(globalOptions: () => GlobalOutputOptions): Command {
  return new Command('gate')
    .description('Run release gate checks for collections, contracts, and audits')
    .option('--collection <file>', 'collection to run')
    .option('--env <name-or-file>', 'environment for collection')
    .option('--openapi <file>', 'OpenAPI file for audit/contract checks')
    .option('--base-url <url>', 'base URL for contract verification')
    .action(
      async (options: {
        collection?: string;
        env?: string;
        openapi?: string;
        baseUrl?: string;
      }) => {
        const result = await runGate(options);
        if (globalOptions().json) printJson({ ok: result.ok, result });
        else {
          process.stdout.write(`Gate: ${result.ok ? 'PASS' : 'FAIL'}\n`);
          for (const check of result.checks) {
            process.stdout.write(
              `- ${check.name}: ${check.ok ? 'PASS' : 'FAIL'} (${check.summary})\n`,
            );
          }
        }
        if (!result.ok) process.exitCode = 6;
      },
    );
}
