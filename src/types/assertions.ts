export interface HeaderAssertion {
  name: string;
  exists?: boolean;
  equals?: string;
  contains?: string;
}

export interface JsonPathAssertion {
  jsonPath: string;
  exists?: boolean;
  equals?: unknown;
  matches?: string;
}

export type Assertion =
  | { status: number }
  | { header: HeaderAssertion }
  | { bodyContains: string }
  | JsonPathAssertion
  | { responseTimeLessThan: number };

export interface AssertionResult {
  name: string;
  passed: boolean;
  expected?: unknown;
  actual?: unknown;
  message?: string;
}
