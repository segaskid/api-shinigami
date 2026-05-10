import { Command } from 'commander';
import { auditOpenApiFile } from '../core/securityAuditor.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';

export function createAuditCommand(globalOptions: () => GlobalOutputOptions): Command {
  return new Command('audit')
    .description('Run defensive API security checks')
    .argument('<openapi-file>', 'OpenAPI JSON or YAML file')
    .action(async (file: string) => {
      const result = await auditOpenApiFile(file);
      if (globalOptions().json) {
        printJson({ ok: result.ok, result });
      } else {
        process.stdout.write(`Findings: ${result.findings.length}\n`);
        for (const finding of result.findings) {
          process.stdout.write(
            `[${finding.severity.toUpperCase()}] ${finding.target}: ${finding.message}\n`,
          );
        }
      }
      if (!result.ok) process.exitCode = 9;
    });
}
