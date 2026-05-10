import { readTextFile, readDataFile } from '../utils/fs.js';

export async function loadDataRows(filePath: string): Promise<Record<string, string>[]> {
  if (filePath.endsWith('.csv')) {
    return parseCsv(await readTextFile(filePath));
  }

  const data = await readDataFile(filePath);
  if (Array.isArray(data)) {
    return data.map((row) => stringifyRecord(row));
  }
  if (data && typeof data === 'object') {
    return [stringifyRecord(data)];
  }
  return [];
}

function stringifyRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, nested === undefined ? '' : String(nested)]),
  );
}

function parseCsv(input: string): Record<string, string>[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const [headerLine, ...rows] = lines;
  if (!headerLine) {
    return [];
  }
  const headers = splitCsvLine(headerLine);
  return rows.map((line) => {
    const values = splitCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
  });
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((value) => value.trim());
}
