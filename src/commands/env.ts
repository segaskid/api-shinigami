import { Command } from 'commander';
import envPaths from 'env-paths';
import { printJson, type GlobalOutputOptions } from '../core/output.js';
import { readDataFile, writeTextFile, fileExists } from '../utils/fs.js';

const paths = envPaths('api-shinigami');
const envFile = `${paths.config}/environment.json`;

export function createEnvCommand(globalOptions: () => GlobalOutputOptions): Command {
  const command = new Command('env').description('Manage environments and variables');
  command.command('list').action(async () => output(await readEnv(), globalOptions()));
  command
    .command('use')
    .argument('<name>')
    .action(async (name: string) => {
      const env = await readEnv();
      env.current = name;
      await writeEnv(env);
      output({ ok: true, current: name }, globalOptions());
    });
  command
    .command('get')
    .argument('<key>')
    .action(async (key: string) =>
      output({ key, value: (await readEnv()).variables[key] }, globalOptions()),
    );
  command
    .command('set')
    .argument('<key>')
    .argument('<value>')
    .action(async (key: string, value: string) => {
      const env = await readEnv();
      env.variables[key] = value;
      await writeEnv(env);
      output({ ok: true, key }, globalOptions());
    });
  command
    .command('unset')
    .argument('<key>')
    .action(async (key: string) => {
      const env = await readEnv();
      delete env.variables[key];
      await writeEnv(env);
      output({ ok: true, key }, globalOptions());
    });
  command
    .command('import')
    .argument('<file>')
    .action(async (file: string) => {
      const data = await readDataFile(file);
      await writeEnv({
        current: (data as { name?: string }).name,
        variables: (data as { variables?: Record<string, string> }).variables ?? {},
      });
      output({ ok: true, file }, globalOptions());
    });
  command
    .command('export')
    .argument('<file>')
    .action(async (file: string) => {
      await writeTextFile(file, JSON.stringify(await readEnv(), null, 2));
      output({ ok: true, file }, globalOptions());
    });
  return command;
}

async function readEnv(): Promise<{ current?: string; variables: Record<string, string> }> {
  if (!(await fileExists(envFile))) return { variables: {} };
  return (await readDataFile(envFile)) as { current?: string; variables: Record<string, string> };
}

async function writeEnv(env: {
  current?: string;
  variables: Record<string, string>;
}): Promise<void> {
  await writeTextFile(envFile, JSON.stringify(env, null, 2));
}

function output(value: unknown, options: GlobalOutputOptions): void {
  if (options.json) printJson(value);
  else process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
