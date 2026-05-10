import { buildRequest } from './requestBuilder.js';
import { sendHttpRequest } from './httpClient.js';
import { validateSchema } from './schemaValidator.js';
import { readDataFile } from '../utils/fs.js';

export interface ContractVerificationResult {
  ok: boolean;
  checked: number;
  skipped: number;
  failures: string[];
}

const SAFE_METHODS = new Set(['get', 'head', 'options']);
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options']);

export async function verifyOpenApiContract(input: {
  openApiFile: string;
  baseUrl: string;
  includeUnsafe?: boolean;
  timeoutMs?: number;
}): Promise<ContractVerificationResult> {
  const spec = await readDataFile(input.openApiFile);
  const failures: string[] = [];
  let checked = 0;
  let skipped = 0;

  for (const [route, pathItem] of Object.entries(asRecord(asRecord(spec).paths))) {
    for (const [method, operationValue] of Object.entries(asRecord(pathItem))) {
      if (!METHODS.has(method)) continue;
      if (!input.includeUnsafe && !SAFE_METHODS.has(method)) {
        skipped += 1;
        continue;
      }
      const operation = asRecord(operationValue);
      const url = `${input.baseUrl.replace(/\/$/, '')}${route.replaceAll(/\{[^}]+}/g, '1')}`;
      try {
        const response = await sendHttpRequest(
          await buildRequest({ method: method.toUpperCase(), url, timeoutMs: input.timeoutMs }),
        );
        checked += 1;
        const responses = asRecord(operation.responses);
        const responseSpec = asRecord(responses[String(response.status)] ?? responses.default);
        if (Object.keys(responseSpec).length === 0) {
          failures.push(
            `${method.toUpperCase()} ${route} returned undocumented status ${response.status}`,
          );
          continue;
        }
        const schema = responseSchema(responseSpec);
        if (schema && response.bodyJson !== undefined) {
          const schemaResult = validateSchema(schema, response.bodyJson);
          if (!schemaResult.valid) {
            failures.push(
              `${method.toUpperCase()} ${route} response schema mismatch: ${schemaResult.errors.join('; ')}`,
            );
          }
        }
      } catch (error) {
        checked += 1;
        failures.push(
          `${method.toUpperCase()} ${route} failed: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }
  }

  return { ok: failures.length === 0, checked, skipped, failures };
}

function responseSchema(response: Record<string, unknown>): unknown | undefined {
  const content = asRecord(response.content);
  const json = asRecord(content['application/json']);
  return json.schema;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
