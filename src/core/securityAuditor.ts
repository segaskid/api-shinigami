import { readDataFile } from '../utils/fs.js';

export interface AuditFinding {
  severity: 'low' | 'medium' | 'high';
  target: string;
  message: string;
}

export interface AuditResult {
  ok: boolean;
  findings: AuditFinding[];
}

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);
const SENSITIVE_FIELD = /(token|secret|password|api[_-]?key|authorization|private[_-]?key)/i;

export async function auditOpenApiFile(filePath: string): Promise<AuditResult> {
  return auditOpenApi(await readDataFile(filePath));
}

export function auditOpenApi(spec: unknown): AuditResult {
  const root = asRecord(spec);
  const findings: AuditFinding[] = [];
  const securitySchemes = asRecord(asRecord(root.components).securitySchemes);
  const globalSecurity = Array.isArray(root.security) ? root.security : [];

  for (const server of Array.isArray(root.servers) ? root.servers : []) {
    const url = String(asRecord(server).url ?? '');
    if (url.startsWith('http://')) {
      findings.push({ severity: 'high', target: url, message: 'Server uses insecure HTTP.' });
    }
  }

  if (Object.keys(securitySchemes).length === 0) {
    findings.push({
      severity: 'medium',
      target: 'components.securitySchemes',
      message: 'No security schemes are declared.',
    });
  }

  for (const [route, pathItem] of Object.entries(asRecord(root.paths))) {
    for (const [method, operationValue] of Object.entries(asRecord(pathItem))) {
      if (!METHODS.has(method)) continue;
      const operation = asRecord(operationValue);
      const target = `${method.toUpperCase()} ${route}`;
      const operationSecurity = Array.isArray(operation.security)
        ? operation.security
        : globalSecurity;
      if (
        operationSecurity.length === 0 &&
        /admin|account|user|auth|token|payment|billing/i.test(route)
      ) {
        findings.push({
          severity: 'high',
          target,
          message: 'Sensitive-looking endpoint has no declared auth.',
        });
      }
      const responses = asRecord(operation.responses);
      if (!responses['401'] && !responses['403'] && operationSecurity.length > 0) {
        findings.push({
          severity: 'medium',
          target,
          message: 'Authenticated endpoint has no 401/403 response.',
        });
      }
      for (const [status, response] of Object.entries(responses)) {
        inspectSchemaFields(asRecord(response), `${target} response ${status}`, findings);
      }
    }
  }

  return { ok: !findings.some((finding) => finding.severity === 'high'), findings };
}

function inspectSchemaFields(
  value: Record<string, unknown>,
  target: string,
  findings: AuditFinding[],
): void {
  const text = JSON.stringify(value);
  const matches = text.match(new RegExp(SENSITIVE_FIELD.source, 'gi')) ?? [];
  for (const match of new Set(matches)) {
    findings.push({
      severity: 'low',
      target,
      message: `Schema or example references sensitive field "${match}".`,
    });
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
