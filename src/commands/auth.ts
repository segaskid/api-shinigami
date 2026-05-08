import { Command } from 'commander';
import { basicToken } from '../core/authManager.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';

export function createAuthCommand(globalOptions: () => GlobalOutputOptions): Command {
  const command = new Command('auth').description('Build auth helper headers');
  command
    .command('bearer')
    .argument('<token>')
    .action((token: string) => output({ Authorization: `Bearer ${token}` }, globalOptions()));
  command
    .command('basic')
    .argument('<username>')
    .argument('<password>')
    .action((username: string, password: string) => {
      output({ Authorization: `Basic ${basicToken(username, password)}` }, globalOptions());
    });
  command
    .command('api-key')
    .argument('<name>')
    .argument('<value>')
    .option('--in <header|query>', 'location', 'header')
    .action((name: string, value: string, options: { in: 'header' | 'query' }) =>
      output({ type: 'api-key', name, value, in: options.in }, globalOptions()),
    );
  command.command('clear').action(() => output({ ok: true }, globalOptions()));
  return command;
}

function output(value: unknown, options: GlobalOutputOptions): void {
  if (options.json) printJson(value);
  else process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
