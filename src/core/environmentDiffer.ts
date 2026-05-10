import { runCollection } from './collectionRunner.js';

export interface EnvironmentDiffResult {
  collection: string;
  left: string;
  right: string;
  differences: EnvironmentDifference[];
}

export interface EnvironmentDifference {
  request: string;
  status?: { left?: number; right?: number };
  bodyChanged: boolean;
  durationDeltaMs: number;
}

export async function diffEnvironments(
  collectionFile: string,
  leftEnv: string,
  rightEnv: string,
): Promise<EnvironmentDiffResult> {
  const left = await runCollection(collectionFile, { env: leftEnv });
  const right = await runCollection(collectionFile, { env: rightEnv });
  const rightByName = new Map(right.results.map((result) => [result.name, result]));
  const differences: EnvironmentDifference[] = [];
  for (const leftResult of left.results) {
    const rightResult = rightByName.get(leftResult.name);
    if (!rightResult) {
      differences.push({
        request: leftResult.name,
        status: { left: leftResult.status },
        bodyChanged: true,
        durationDeltaMs: Math.round(leftResult.durationMs),
      });
      continue;
    }
    const bodyChanged = leftResult.response?.bodyText !== rightResult.response?.bodyText;
    const statusChanged = leftResult.status !== rightResult.status;
    if (bodyChanged || statusChanged) {
      differences.push({
        request: leftResult.name,
        ...(statusChanged
          ? { status: { left: leftResult.status, right: rightResult.status } }
          : {}),
        bodyChanged,
        durationDeltaMs: Math.round(rightResult.durationMs - leftResult.durationMs),
      });
    }
  }

  return {
    collection: left.collectionName,
    left: leftEnv,
    right: rightEnv,
    differences,
  };
}
