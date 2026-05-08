import { Command } from 'commander';
import { clearHistory, getHistoryEntry, listHistoryEntries } from '../core/historyStore.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';

export function createHistoryCommand(globalOptions: () => GlobalOutputOptions): Command {
  const command = new Command('history').description('Show recent requests and runs');
  command.command('list').action(async () => {
    const entries = await listHistoryEntries();
    if (globalOptions().json) printJson({ ok: true, entries });
    else
      for (const entry of entries)
        process.stdout.write(`${entry.id} ${entry.timestamp} ${entry.kind}\n`);
  });
  command
    .command('show')
    .argument('<id>')
    .action(async (id: string) => {
      const entry = await getHistoryEntry(id);
      if (globalOptions().json) printJson({ ok: Boolean(entry), entry });
      else process.stdout.write(`${JSON.stringify(entry ?? { error: 'not found' }, null, 2)}\n`);
    });
  command.command('clear').action(async () => {
    await clearHistory();
    if (globalOptions().json) printJson({ ok: true });
    else process.stdout.write('History cleared.\n');
  });
  return command;
}
