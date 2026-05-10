import { fileExists, readDataFile, writeTextFile } from '../utils/fs.js';
import { toYaml } from '../utils/yaml.js';

export interface WorkspaceStatus {
  root: string;
  initialized: boolean;
  paths: Record<string, boolean>;
}

const WORKSPACE_DIR = '.shinigami';
const WORKSPACE_FILES = [
  '.shinigami/config.yml',
  '.shinigami/environments',
  '.shinigami/collections',
  '.shinigami/reports',
  '.shinigami/history',
];

export async function initWorkspace(root = process.cwd()): Promise<WorkspaceStatus> {
  await writeTextFile(
    `${root}/.shinigami/config.yml`,
    toYaml({
      version: 1,
      defaultEnvironment: 'local',
      history: { enabled: true },
      redaction: { enabled: true },
    }),
  );
  await writeTextFile(
    `${root}/.shinigami/environments/local.yml`,
    toYaml({ name: 'local', variables: { baseUrl: 'http://localhost:3000' }, secrets: {} }),
  );
  await writeTextFile(`${root}/.shinigami/collections/.gitkeep`, '');
  await writeTextFile(`${root}/.shinigami/reports/.gitkeep`, '');
  await writeTextFile(`${root}/.shinigami/history/.gitkeep`, '');
  return workspaceStatus(root);
}

export async function workspaceStatus(root = process.cwd()): Promise<WorkspaceStatus> {
  const paths: Record<string, boolean> = {};
  for (const filePath of WORKSPACE_FILES) {
    paths[filePath] = await fileExists(`${root}/${filePath}`);
  }
  return {
    root,
    initialized: await fileExists(`${root}/${WORKSPACE_DIR}/config.yml`),
    paths,
  };
}

export async function workspaceDoctor(root = process.cwd()): Promise<{
  ok: boolean;
  checks: { name: string; passed: boolean; message: string }[];
}> {
  const status = await workspaceStatus(root);
  const checks = [
    {
      name: 'workspace initialized',
      passed: status.initialized,
      message: status.initialized ? '.shinigami/config.yml exists' : 'Run shinigami workspace init',
    },
    {
      name: 'node version',
      passed: Number(process.versions.node.split('.')[0]) >= 20,
      message: `Node ${process.versions.node}`,
    },
  ];

  if (status.initialized) {
    try {
      await readDataFile(`${root}/.shinigami/config.yml`);
      checks.push({ name: 'workspace config', passed: true, message: 'config.yml is readable' });
    } catch (error) {
      checks.push({
        name: 'workspace config',
        passed: false,
        message: error instanceof Error ? error.message : 'config.yml is invalid',
      });
    }
  }

  return {
    ok: checks.every((check) => check.passed),
    checks,
  };
}
