import { Command } from 'commander';
import { sniffPageEndpoints, sniffResultToCollectionYaml } from '../core/apiSniffer.js';
import { importHarFileToYaml } from '../core/harImporter.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';
import { writeTextFile } from '../utils/fs.js';

export function createCaptureCommand(globalOptions: () => GlobalOutputOptions): Command {
  const command = new Command('capture').description('Capture API traffic into reusable artifacts');

  command
    .command('sniff')
    .argument('<url>')
    .requiredOption('--output <file>', 'write collection output')
    .option('--browser', 'use Playwright runtime capture if available')
    .action(async (url: string, options: { output: string; browser?: boolean }) => {
      const result = await sniffPageEndpoints(url, { browser: options.browser });
      await writeTextFile(options.output, sniffResultToCollectionYaml(result, 'Captured API'));
      if (globalOptions().json)
        printJson({ ok: true, endpoints: result.endpoints.length, output: options.output });
      else
        process.stdout.write(
          `Captured ${result.endpoints.length} endpoints to ${options.output}\n`,
        );
    });

  command
    .command('har')
    .argument('<file>')
    .requiredOption('--output <file>', 'write collection output')
    .action(async (file: string, options: { output: string }) => {
      await writeTextFile(options.output, await importHarFileToYaml(file));
      if (globalOptions().json) printJson({ ok: true, output: options.output });
      else process.stdout.write(`Captured HAR as ${options.output}\n`);
    });

  return command;
}
