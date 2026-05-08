import type { CollectionRunResult } from './collection.js';

export interface ReportRecord {
  id: string;
  createdAt: string;
  kind: 'collection' | 'test';
  result: CollectionRunResult;
}
