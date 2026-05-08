import chalk from 'chalk';
import { ShinigamiError } from './errors.js';

export interface GlobalOutputOptions {
  json?: boolean;
  quiet?: boolean;
  verbose?: boolean;
  color?: boolean;
}

export function configureColor(color: boolean | undefined): void {
  if (color === false) {
    chalk.level = 0;
  }
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printError(error: ShinigamiError, options: GlobalOutputOptions = {}): void {
  if (options.json) {
    printJson({
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.hint ? { hint: error.hint } : {}),
      },
    });
    return;
  }

  const lines = [`${chalk.red('Error:')} ${error.message}`];
  if (error.reason) {
    lines.push(`${chalk.bold('Reason:')} ${error.reason}`);
  }
  if (error.hint) {
    lines.push(`${chalk.bold('Hint:')} ${error.hint}`);
  }
  process.stderr.write(`${lines.join('\n')}\n`);
}

export function title(text = 'API Shinigami'): string {
  return `${chalk.cyan('API Shinigami')} ${chalk.dim('⛩')}\n${text === 'API Shinigami' ? '' : text}`;
}
