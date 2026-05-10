import { Command } from 'commander';
import { replayHar } from '../core/replayEngine.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';

export function createReplayCommand(globalOptions: () => GlobalOutputOptions): Command {
  return new Command('replay')
    .description('Replay captured traffic from HAR files')
    .argument('<har-file>', 'HAR file to replay')
    .option('--target <base-url>', 'rewrite traffic to target base URL')
    .action(async (file: string, options: { target?: string }) => {
      const result = await replayHar({ file, target: options.target });
      if (globalOptions().json) printJson({ ok: result.failed === 0, result });
      else {
        process.stdout.write(
          `Replayed: ${result.total}\nPassed: ${result.passed}\nFailed: ${result.failed}\n`,
        );
        for (const item of result.results.filter((entry) => !entry.passed)) {
          process.stdout.write(
            `- ${item.method} ${item.url}: expected ${item.expectedStatus}, got ${item.actualStatus ?? item.error}\n`,
          );
        }
      }
      if (result.failed > 0) process.exitCode = 6;
    });
}
