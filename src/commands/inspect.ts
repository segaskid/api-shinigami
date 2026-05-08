import { Command } from 'commander';
import Table from 'cli-table3';
import { inspectOpenApi } from '../core/openApiInspector.js';
import { buildRequest } from '../core/requestBuilder.js';
import { sendHttpRequest } from '../core/httpClient.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';
import { readDataFile } from '../utils/fs.js';

export function createInspectCommand(globalOptions: () => GlobalOutputOptions): Command {
  const command = new Command('inspect').description(
    'Inspect API schemas, responses, and endpoints',
  );
  command
    .command('openapi')
    .argument('<file-or-url>')
    .action(async (source: string) => {
      const result = await inspectOpenApi(source);
      if (globalOptions().json) printJson({ ok: true, result });
      else process.stdout.write(formatOpenApi(result));
    });
  command
    .command('response')
    .argument('<file>')
    .action(async (file: string) => {
      const response = await readDataFile(file);
      if (globalOptions().json) printJson({ ok: true, response });
      else process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
    });
  command
    .command('endpoint')
    .argument('<method>')
    .argument('<url>')
    .action(async (method: string, url: string) => {
      const response = await sendHttpRequest(await buildRequest({ method, url }));
      if (globalOptions().json) printJson({ ok: true, response });
      else
        process.stdout.write(
          `${method.toUpperCase()} ${url}\nStatus: ${response.status}\nTime: ${Math.round(response.durationMs)}ms\n`,
        );
    });
  return command;
}

function formatOpenApi(result: Awaited<ReturnType<typeof inspectOpenApi>>): string {
  const table = new Table({ head: ['Method', 'Count'] });
  for (const [method, count] of Object.entries(result.methodCounts)) table.push([method, count]);
  return [
    `Title: ${result.title}`,
    `Version: ${result.version}`,
    `Servers: ${result.servers.join(', ') || '(none)'}`,
    `Endpoint count: ${result.endpointCount}`,
    '',
    table.toString(),
    '',
    `Tags: ${result.tags.join(', ') || '(none)'}`,
    `Warnings: ${result.warnings.length}`,
    ...result.warnings.map((warning) => `- ${warning}`),
    '',
  ].join('\n');
}
