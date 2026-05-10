import { Command } from 'commander';
import { explainFailure } from '../core/failureExplainer.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';
import { readDataFile } from '../utils/fs.js';

export function createExplainCommand(globalOptions: () => GlobalOutputOptions): Command {
  return new Command('explain')
    .description('Explain a failed run, error string, or JSON report')
    .argument('<input>', 'error text or JSON/YAML file')
    .action(async (input: string) => {
      const value = looksLikeFile(input) ? await readDataFile(input) : input;
      const explanation = explainFailure(value);
      if (globalOptions().json) printJson({ ok: true, explanation });
      else {
        process.stdout.write(`${explanation.category}: ${explanation.message}\n`);
        for (const step of explanation.nextSteps) process.stdout.write(`- ${step}\n`);
      }
    });
}

function looksLikeFile(value: string): boolean {
  return /\.(json|ya?ml)$/i.test(value) || value.includes('/');
}
