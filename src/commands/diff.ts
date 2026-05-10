import { Command } from 'commander';
import { diffEnvironments } from '../core/environmentDiffer.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';

export function createDiffCommand(globalOptions: () => GlobalOutputOptions): Command {
  return new Command('diff')
    .description('Compare collection behavior across two environments')
    .argument('<collection>', 'collection file')
    .requiredOption('--env <name>', 'left environment', collect, [])
    .action(async (collection: string, options: { env: string[] }) => {
      const [left, right] = options.env;
      if (!left || !right) throw new Error('Provide exactly two --env values.');
      const result = await diffEnvironments(collection, left, right);
      if (globalOptions().json) printJson({ ok: result.differences.length === 0, result });
      else {
        process.stdout.write(`${result.collection}: ${left} vs ${right}\n`);
        process.stdout.write(`Differences: ${result.differences.length}\n`);
        for (const diff of result.differences) {
          process.stdout.write(`- ${diff.request}: ${JSON.stringify(diff)}\n`);
        }
      }
    });
}

function collect(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}
