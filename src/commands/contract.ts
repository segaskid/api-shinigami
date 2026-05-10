import { Command } from 'commander';
import { verifyOpenApiContract } from '../core/contractVerifier.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';

export function createContractCommand(globalOptions: () => GlobalOutputOptions): Command {
  const command = new Command('contract').description('Verify real APIs against contracts');

  command
    .command('verify')
    .argument('<openapi-file>', 'OpenAPI JSON or YAML file')
    .requiredOption('--base-url <url>', 'base URL to verify against')
    .option('--include-unsafe', 'also execute non-GET methods')
    .option('--timeout <ms>', 'request timeout in milliseconds')
    .action(
      async (
        openApiFile: string,
        options: { baseUrl: string; includeUnsafe?: boolean; timeout?: string },
      ) => {
        const result = await verifyOpenApiContract({
          openApiFile,
          baseUrl: options.baseUrl,
          includeUnsafe: options.includeUnsafe,
          timeoutMs: options.timeout ? Number(options.timeout) : undefined,
        });
        if (globalOptions().json) printJson({ ok: result.ok, result });
        else {
          process.stdout.write(
            `Checked: ${result.checked}\nSkipped: ${result.skipped}\nFailures: ${result.failures.length}\n`,
          );
          for (const failure of result.failures) process.stdout.write(`- ${failure}\n`);
        }
        if (!result.ok) process.exitCode = 9;
      },
    );

  return command;
}
