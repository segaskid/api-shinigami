import { Command } from 'commander';
import { createRequestCommand } from './commands/request.js';
import { createCollectionCommand } from './commands/collection.js';
import { createTestCommand } from './commands/test.js';
import { createEnvCommand } from './commands/env.js';
import { createAuthCommand } from './commands/auth.js';
import { createInspectCommand } from './commands/inspect.js';
import { createFuzzCommand } from './commands/fuzz.js';
import { createReportCommand } from './commands/report.js';
import { createHistoryCommand } from './commands/history.js';
import { createConfigCommand } from './commands/config.js';
import { ExitCode } from './core/exitCodes.js';
import { toShinigamiError } from './core/errors.js';
import { configureColor, printError, type GlobalOutputOptions } from './core/output.js';

export async function runCli(argv: string[]): Promise<void> {
  const program = new Command();

  program
    .name('shinigami')
    .description('API Shinigami: a terminal-native API testing, debugging, and automation toolkit')
    .version('0.1.0')
    .option('--json', 'print machine-readable JSON output')
    .option('--verbose', 'print verbose logs')
    .option('--quiet', 'suppress human output')
    .option('--no-color', 'disable colored output')
    .exitOverride();

  const globalOptions = (): GlobalOutputOptions => {
    const options = program.opts<{
      json?: boolean;
      verbose?: boolean;
      quiet?: boolean;
      color?: boolean;
    }>();
    return {
      json: options.json,
      verbose: options.verbose,
      quiet: options.quiet,
      color: options.color,
    };
  };

  program.addCommand(createRequestCommand(globalOptions));
  program.addCommand(createCollectionCommand(globalOptions));
  program.addCommand(createTestCommand(globalOptions));
  program.addCommand(createEnvCommand(globalOptions));
  program.addCommand(createAuthCommand(globalOptions));
  program.addCommand(createInspectCommand(globalOptions));
  program.addCommand(createFuzzCommand(globalOptions));
  program.addCommand(createReportCommand(globalOptions));
  program.addCommand(createHistoryCommand(globalOptions));
  program.addCommand(createConfigCommand(globalOptions));

  try {
    await program.parseAsync(rewriteRequestJsonBodyOption(argv));
  } catch (error) {
    const commanderError = error as { code?: string; exitCode?: number };
    if (
      commanderError.code === 'commander.helpDisplayed' ||
      commanderError.code === 'commander.version'
    ) {
      process.exitCode = ExitCode.Success;
      return;
    }
    if (commanderError.code?.startsWith('commander.')) {
      process.exitCode = ExitCode.InvalidArguments;
      return;
    }
    configureColor(globalOptions().color);
    const shinigamiError = toShinigamiError(error);
    printError(shinigamiError, globalOptions());
    process.exitCode = shinigamiError.exitCode;
  }
}

function rewriteRequestJsonBodyOption(argv: string[]): string[] {
  const requestIndex = argv.indexOf('request');
  if (requestIndex < 0) {
    return argv;
  }

  const output = [...argv];
  for (let index = requestIndex + 1; index < output.length; index += 1) {
    if (output[index] === '--json' && output[index + 1] && !output[index + 1].startsWith('-')) {
      output[index] = '--json-body';
    }
  }
  return output;
}
