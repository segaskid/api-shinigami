import { Command } from 'commander';
import { inferOpenApiFromHar, inferOpenApiYamlFromHar } from '../core/schemaInferer.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';
import { writeTextFile } from '../utils/fs.js';

export function createSchemaCommand(globalOptions: () => GlobalOutputOptions): Command {
  const command = new Command('schema').description('Infer and work with API schemas');

  command
    .command('infer')
    .argument('<har-file>', 'HAR file to infer from')
    .option('--output <file>', 'write inferred OpenAPI YAML')
    .action(async (file: string, options: { output?: string }) => {
      if (globalOptions().json) {
        printJson({ ok: true, openapi: await inferOpenApiFromHar(file) });
        return;
      }
      const yaml = await inferOpenApiYamlFromHar(file);
      if (options.output) await writeTextFile(options.output, yaml);
      else process.stdout.write(yaml);
    });

  return command;
}
