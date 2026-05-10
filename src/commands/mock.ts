import { Command } from 'commander';
import { createMockServerFromCollection, createMockServerFromOpenApi } from '../core/mockServer.js';
import type { GlobalOutputOptions } from '../core/output.js';

export function createMockCommand(_globalOptions?: () => GlobalOutputOptions): Command {
  return new Command('mock')
    .description('Start a mock API server from a collection or OpenAPI file')
    .argument('<file>', 'collection or OpenAPI file')
    .option('--port <number>', 'port to listen on', '4010')
    .option('--openapi', 'treat input as OpenAPI')
    .action(async (file: string, options: { port: string; openapi?: boolean }) => {
      const server = options.openapi
        ? await createMockServerFromOpenApi(file)
        : await createMockServerFromCollection(file);
      server.listen(Number(options.port), () => {
        process.stdout.write(`Mock server listening on http://127.0.0.1:${options.port}\n`);
      });
    });
}
