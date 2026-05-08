import fs from 'node:fs/promises';
import path from 'node:path';
import fsExtra from 'fs-extra';
import { ExitCode } from '../core/exitCodes.js';
import { ShinigamiError } from '../core/errors.js';
import { parseJson } from './json.js';
import { parseYaml } from './yaml.js';

export async function readTextFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unable to read file.';
    throw new ShinigamiError({
      code: 'FILE_READ_FAILED',
      message: `Could not read ${filePath}.`,
      reason,
      hint: 'Check that the file exists and is readable.',
      exitCode: ExitCode.FileError,
    });
  }
}

export async function readDataFile(filePath: string): Promise<unknown> {
  const text = await readTextFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.json') {
    return parseJson(text, filePath);
  }
  return parseYaml(text, filePath);
}

export async function writeTextFile(filePath: string, content: string): Promise<void> {
  await fsExtra.ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, content, 'utf8');
}

export async function fileExists(filePath: string): Promise<boolean> {
  return fsExtra.pathExists(filePath);
}
