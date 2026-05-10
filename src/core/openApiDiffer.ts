import { readDataFile } from '../utils/fs.js';

export interface OpenApiDiff {
  ok: boolean;
  breaking: string[];
  nonBreaking: string[];
}

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']);

export async function diffOpenApiFiles(
  beforeFile: string,
  afterFile: string,
): Promise<OpenApiDiff> {
  const before = await readDataFile(beforeFile);
  const after = await readDataFile(afterFile);
  return diffOpenApi(before, after);
}

export function diffOpenApi(before: unknown, after: unknown): OpenApiDiff {
  const beforeOps = operationMap(before);
  const afterOps = operationMap(after);
  const breaking: string[] = [];
  const nonBreaking: string[] = [];

  for (const [key, operation] of beforeOps) {
    const next = afterOps.get(key);
    if (!next) {
      breaking.push(`Removed operation ${key}`);
      continue;
    }

    for (const required of requiredRequestFields(operation)) {
      if (!requiredRequestFields(next).has(required)) {
        nonBreaking.push(`Request field ${required} is no longer required in ${key}`);
      }
    }
    for (const required of requiredRequestFields(next)) {
      if (!requiredRequestFields(operation).has(required)) {
        breaking.push(`New required request field ${required} in ${key}`);
      }
    }

    for (const status of successStatuses(operation)) {
      if (!successStatuses(next).has(status)) {
        breaking.push(`Removed success response ${status} from ${key}`);
      }
    }
  }

  for (const key of afterOps.keys()) {
    if (!beforeOps.has(key)) {
      nonBreaking.push(`Added operation ${key}`);
    }
  }

  return {
    ok: breaking.length === 0,
    breaking,
    nonBreaking,
  };
}

function operationMap(spec: unknown): Map<string, Record<string, unknown>> {
  const paths = asRecord(asRecord(spec).paths);
  const map = new Map<string, Record<string, unknown>>();
  for (const [route, pathItem] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(asRecord(pathItem))) {
      if (METHODS.has(method)) {
        map.set(`${method.toUpperCase()} ${route}`, asRecord(operation));
      }
    }
  }
  return map;
}

function requiredRequestFields(operation: Record<string, unknown>): Set<string> {
  const required = new Set<string>();
  const requestBody = asRecord(operation.requestBody);
  for (const media of Object.values(asRecord(requestBody.content))) {
    const schema = asRecord(asRecord(media).schema);
    for (const field of Array.isArray(schema.required) ? schema.required : []) {
      required.add(String(field));
    }
  }
  return required;
}

function successStatuses(operation: Record<string, unknown>): Set<string> {
  return new Set(
    Object.keys(asRecord(operation.responses)).filter(
      (status) => status.startsWith('2') || status === 'default',
    ),
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
