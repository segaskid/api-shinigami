import { Command } from 'commander';
import {
  latestReport,
  listReports,
  reportToHtml,
  reportToMarkdown,
} from '../core/reportGenerator.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';
import { writeTextFile } from '../utils/fs.js';

export function createReportCommand(globalOptions: () => GlobalOutputOptions): Command {
  const command = new Command('report').description(
    'Generate reports from test and collection runs',
  );
  command
    .command('latest')
    .option('--html', 'print HTML')
    .action(async (options: { html?: boolean }) => {
      const report = await latestReport();
      if (globalOptions().json) printJson({ ok: Boolean(report), report });
      else if (!report) process.stdout.write('No reports found.\n');
      else process.stdout.write(options.html ? reportToHtml(report) : reportToMarkdown(report));
    });
  command
    .command('open')
    .argument('<file>')
    .action((file: string) => {
      process.stdout.write(`Open report file in your browser or editor: ${file}\n`);
    });
  command
    .command('generate')
    .argument('<run-id>')
    .option('--format <html|json|md>', 'format', 'md')
    .option('--output <file>')
    .action(async (runId: string, options: { format: 'html' | 'json' | 'md'; output?: string }) => {
      const report = (await listReports()).find((item) => item.id === runId);
      const content = !report
        ? 'Report not found.\n'
        : options.format === 'json'
          ? JSON.stringify(report, null, 2)
          : options.format === 'html'
            ? reportToHtml(report)
            : reportToMarkdown(report);
      if (options.output) await writeTextFile(options.output, content);
      else process.stdout.write(content);
    });
  return command;
}
