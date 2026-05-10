import { Command } from 'commander';
import {
  importCurl,
  importedCurlToCollectionYaml,
  importedCurlToShinigamiCommand,
} from '../core/curlImporter.js';
import { importHarFileToYaml } from '../core/harImporter.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';
import { writeTextFile } from '../utils/fs.js';

export function createImportCommand(globalOptions: () => GlobalOutputOptions): Command {
  const command = new Command('import').description('Import API definitions and request snippets');

  command
    .command('curl')
    .argument('<command...>', 'curl command string')
    .option('--format <command|collection|json>', 'output format', 'command')
    .option('--name <name>', 'collection name', 'Imported curl request')
    .option('--output <file>', 'write output to file')
    .action(
      async (
        commandParts: string[],
        options: { format: 'command' | 'collection' | 'json'; name: string; output?: string },
      ) => {
        const request = importCurl(commandParts.join(' '));
        const output =
          options.format === 'json'
            ? JSON.stringify({ ok: true, request }, null, 2)
            : options.format === 'collection'
              ? importedCurlToCollectionYaml(request, options.name)
              : importedCurlToShinigamiCommand(request);

        if (options.output) {
          await writeTextFile(options.output, output.endsWith('\n') ? output : `${output}\n`);
        } else if (globalOptions().json || options.format === 'json') {
          printJson({ ok: true, request });
        } else {
          process.stdout.write(output.endsWith('\n') ? output : `${output}\n`);
        }
      },
    );

  command
    .command('har')
    .argument('<file>', 'HAR file exported from a browser or proxy')
    .option('--output <file>', 'write collection to file')
    .action(async (file: string, options: { output?: string }) => {
      const yaml = await importHarFileToYaml(file);
      if (options.output) {
        await writeTextFile(options.output, yaml);
      } else {
        process.stdout.write(yaml);
      }
    });

  return command;
}
