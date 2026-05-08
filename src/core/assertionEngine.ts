import type { Assertion, AssertionResult } from '../types/assertions.js';
import type { ShinigamiResponse } from '../types/api.js';

export function runAssertions(
  assertions: Assertion[] = [],
  response: ShinigamiResponse,
): AssertionResult[] {
  return assertions.map((assertion) => runAssertion(assertion, response));
}

function runAssertion(assertion: Assertion, response: ShinigamiResponse): AssertionResult {
  try {
    if ('status' in assertion) {
      return result(
        `status is ${assertion.status}`,
        response.status === assertion.status,
        assertion.status,
        response.status,
      );
    }

    if ('header' in assertion) {
      return runHeaderAssertion(assertion.header, response);
    }

    if ('bodyContains' in assertion) {
      return result(
        `body contains ${assertion.bodyContains}`,
        response.bodyText.includes(assertion.bodyContains),
        assertion.bodyContains,
        response.bodyText,
      );
    }

    if ('jsonPath' in assertion) {
      return runJsonPathAssertion(assertion, response);
    }

    if ('responseTimeLessThan' in assertion) {
      return result(
        `response time less than ${assertion.responseTimeLessThan}ms`,
        response.durationMs < assertion.responseTimeLessThan,
        assertion.responseTimeLessThan,
        Math.round(response.durationMs),
      );
    }

    return {
      name: 'unknown assertion',
      passed: false,
      message: 'Unsupported assertion shape.',
    };
  } catch (error) {
    return {
      name: 'malformed assertion',
      passed: false,
      message: error instanceof Error ? error.message : 'Assertion failed unexpectedly.',
    };
  }
}

function runHeaderAssertion(
  assertion: { name: string; exists?: boolean; equals?: string; contains?: string },
  response: ShinigamiResponse,
): AssertionResult {
  const headers = lowerCaseKeys(response.headers);
  const actual = headers[assertion.name.toLowerCase()];

  if (assertion.exists !== undefined) {
    return result(
      `header ${assertion.name} exists`,
      (actual !== undefined) === assertion.exists,
      assertion.exists,
      actual,
    );
  }
  if (assertion.equals !== undefined) {
    return result(
      `header ${assertion.name} equals`,
      actual === assertion.equals,
      assertion.equals,
      actual,
    );
  }
  if (assertion.contains !== undefined) {
    return result(
      `header ${assertion.name} contains`,
      actual?.includes(assertion.contains) ?? false,
      assertion.contains,
      actual,
    );
  }

  return {
    name: `header ${assertion.name}`,
    passed: false,
    message: 'Header assertion needs exists, equals, or contains.',
  };
}

function runJsonPathAssertion(
  assertion: { jsonPath: string; exists?: boolean; equals?: unknown; matches?: string },
  response: ShinigamiResponse,
): AssertionResult {
  const actual = getPath(response.bodyJson, assertion.jsonPath);
  if (assertion.exists !== undefined) {
    return result(
      `jsonPath ${assertion.jsonPath} exists`,
      (actual !== undefined) === assertion.exists,
      assertion.exists,
      actual,
    );
  }
  if ('equals' in assertion) {
    return result(
      `jsonPath ${assertion.jsonPath} equals`,
      JSON.stringify(actual) === JSON.stringify(assertion.equals),
      assertion.equals,
      actual,
    );
  }
  if (assertion.matches !== undefined) {
    return result(
      `jsonPath ${assertion.jsonPath} matches`,
      typeof actual === 'string' && new RegExp(assertion.matches).test(actual),
      assertion.matches,
      actual,
    );
  }

  return {
    name: `jsonPath ${assertion.jsonPath}`,
    passed: false,
    message: 'JSON path assertion needs exists, equals, or matches.',
  };
}

function getPath(value: unknown, path: string): unknown {
  const normalized = path.replace(/^\$\.?/, '');
  if (!normalized) {
    return value;
  }

  return normalized.split('.').reduce<unknown>((current, segment) => {
    if (current === undefined || current === null) {
      return undefined;
    }
    if (/^\d+$/.test(segment) && Array.isArray(current)) {
      return current[Number(segment)];
    }
    if (typeof current === 'object' && segment in current) {
      return (current as Record<string, unknown>)[segment];
    }
    return undefined;
  }, value);
}

function lowerCaseKeys(headers: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

function result(
  name: string,
  passed: boolean,
  expected: unknown,
  actual: unknown,
): AssertionResult {
  return {
    name,
    passed,
    expected,
    actual,
    ...(passed
      ? {}
      : { message: `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}.` }),
  };
}
