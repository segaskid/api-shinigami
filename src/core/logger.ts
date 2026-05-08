import type { GlobalOutputOptions } from './output.js';

export class Logger {
  constructor(private readonly options: GlobalOutputOptions = {}) {}

  info(message: string): void {
    if (!this.options.quiet && !this.options.json) {
      process.stdout.write(`${message}\n`);
    }
  }

  warn(message: string): void {
    if (!this.options.quiet && !this.options.json) {
      process.stderr.write(`${message}\n`);
    }
  }

  debug(message: string): void {
    if (this.options.verbose && !this.options.json) {
      process.stderr.write(`${message}\n`);
    }
  }
}
