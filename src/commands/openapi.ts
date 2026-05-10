import { Command } from 'commander';
import { generateCollectionYamlFromOpenApi } from '../core/openApiCollectionGenerator.js';
import { inspectOpenApi } from '../core/openApiInspector.js';
import { diffOpenApiFiles } from '../core/openApiDiffer.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';
import { writeTextFile } from '../utils/fs.js';

export function createOpenApiCommand(globalOptions: () => GlobalOutputOptions): Command {
  const command = new Command('openapi').description('Work with OpenAPI specifications');

  command
    .command('lint')
    .argument('<file>')
    .action(async (file: string) => {
      const result = await inspectOpenApi(file);
      if (globalOptions().json) printJson({ ok: result.warnings.length === 0, result });
      else {
        process.stdout.write(
          `OpenAPI: ${result.title} ${result.version}\nWarnings: ${result.warnings.length}\n`,
        );
        for (const warning of result.warnings) process.stdout.write(`- ${warning}\n`);
      }
    });

  command
    .command('generate-collection')
    .argument('<file>')
    .option('--output <file>', 'write generated collection')
    .action(async (file: string, options: { output?: string }) => {
      const yaml = await generateCollectionYamlFromOpenApi(file);
      if (options.output) {
        await writeTextFile(options.output, yaml);
        if (globalOptions().json) printJson({ ok: true, output: options.output });
        else process.stdout.write(`Generated ${options.output}\n`);
      } else {
        process.stdout.write(yaml);
      }
    });

  command
    .command('diff')
    .argument('<before>')
    .argument('<after>')
    .action(async (before: string, after: string) => {
      const result = await diffOpenApiFiles(before, after);
      if (globalOptions().json) {
        printJson({ ok: result.ok, result });
      } else {
        process.stdout.write(`Breaking changes: ${result.breaking.length}\n`);
        for (const item of result.breaking) process.stdout.write(`- ${item}\n`);
        process.stdout.write(`Non-breaking changes: ${result.nonBreaking.length}\n`);
        for (const item of result.nonBreaking) process.stdout.write(`- ${item}\n`);
      }
      if (!result.ok) {
        process.exitCode = 9;
      }
    });

  return command;
}
