import { readDataFile } from '../utils/fs.js';

export interface HarRequestRecord {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  status?: number;
  responseBody?: unknown;
}

export async function readHarRequests(filePath: string): Promise<HarRequestRecord[]> {
  const har = asRecord(await readDataFile(filePath));
  const rawEntries = asRecord(har.log).entries;
  const entries: unknown[] = Array.isArray(rawEntries) ? rawEntries : [];
  return entries.map((entry) => {
    const entryRecord = asRecord(entry);
    const request = asRecord(entryRecord.request);
    const response = asRecord(entryRecord.response);
    const content = asRecord(response.content);
    const postData = asRecord(request.postData);
    return {
      method: String(request.method ?? 'GET'),
      url: String(request.url ?? ''),
      headers: headerArrayToRecord(request.headers),
      ...(postData.text ? { body: String(postData.text) } : {}),
      status: Number(response.status ?? 0) || undefined,
      responseBody: parseBody(content.text),
    };
  });
}

function headerArrayToRecord(value: unknown): Record<string, string> {
  if (!Array.isArray(value)) {
    return {};
  }
  return Object.fromEntries(
    value.map((header) => {
      const record = asRecord(header);
      return [String(record.name), String(record.value)];
    }),
  );
}

function parseBody(value: unknown): unknown {
  if (typeof value !== 'string') {
    return undefined;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
