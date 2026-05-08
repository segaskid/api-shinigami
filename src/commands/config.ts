import { Command } from 'commander';
import {
  defaultConfig,
  getConfigValue,
  loadConfig,
  saveConfig,
  setConfigValue,
} from '../core/configStore.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';

export function createConfigCommand(globalOptions: () => GlobalOutputOptions): Command {
  const command = new Command('config').description('Manage global configuration');
  command.command('list').action(async () => output(await loadConfig(), globalOptions()));
  command
    .command('get')
    .argument('<key>')
    .action(async (key: string) =>
      output({ key, value: getConfigValue(await loadConfig(), key) }, globalOptions()),
    );
  command
    .command('set')
    .argument('<key>')
    .argument('<value>')
    .action(async (key: string, value: string) => {
      const config = setConfigValue(await loadConfig(), key, value);
      await saveConfig(config);
      output({ ok: true, key, value: getConfigValue(config, key) }, globalOptions());
    });
  command.command('reset').action(async () => {
    await saveConfig(defaultConfig);
    output({ ok: true, config: defaultConfig }, globalOptions());
  });
  return command;
}

function output(value: unknown, options: GlobalOutputOptions): void {
  if (options.json) printJson(value);
  else process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
