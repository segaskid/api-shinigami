import { Command } from 'commander';
import { initWorkspace, workspaceDoctor, workspaceStatus } from '../core/workspaceManager.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';

export function createWorkspaceCommand(globalOptions: () => GlobalOutputOptions): Command {
  const command = new Command('workspace').description('Manage API Shinigami workspace files');

  command
    .command('init')
    .description('Create a .shinigami workspace')
    .action(async () => {
      const status = await initWorkspace();
      output(status, globalOptions());
    });

  command
    .command('status')
    .description('Show workspace status')
    .action(async () => {
      output(await workspaceStatus(), globalOptions());
    });

  command
    .command('doctor')
    .description('Check local workspace readiness')
    .action(async () => {
      output(await workspaceDoctor(), globalOptions());
    });

  return command;
}

function output(value: unknown, options: GlobalOutputOptions): void {
  if (options.json) {
    printJson(value);
  } else {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  }
}
