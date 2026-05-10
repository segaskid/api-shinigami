import { auditOpenApiFile } from './securityAuditor.js';
import { verifyOpenApiContract } from './contractVerifier.js';
import { runCollection } from './collectionRunner.js';

export interface GateResult {
  ok: boolean;
  checks: { name: string; ok: boolean; summary: string }[];
}

export async function runGate(input: {
  collection?: string;
  env?: string;
  openapi?: string;
  baseUrl?: string;
}): Promise<GateResult> {
  const checks: GateResult['checks'] = [];

  if (input.collection) {
    const result = await runCollection(input.collection, { env: input.env });
    checks.push({
      name: 'collection',
      ok: result.failedRequests === 0,
      summary: `${result.passedRequests}/${result.totalRequests} requests passed`,
    });
  }

  if (input.openapi) {
    const audit = await auditOpenApiFile(input.openapi);
    checks.push({
      name: 'audit',
      ok: audit.ok,
      summary: `${audit.findings.length} findings`,
    });
  }

  if (input.openapi && input.baseUrl) {
    const contract = await verifyOpenApiContract({
      openApiFile: input.openapi,
      baseUrl: input.baseUrl,
    });
    checks.push({
      name: 'contract',
      ok: contract.ok,
      summary: `${contract.checked} checked, ${contract.failures.length} failures`,
    });
  }

  return { ok: checks.every((check) => check.ok), checks };
}
