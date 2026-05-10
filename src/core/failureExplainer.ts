export interface Explanation {
  category: string;
  message: string;
  nextSteps: string[];
}

export function explainFailure(input: unknown): Explanation {
  const text = typeof input === 'string' ? input : JSON.stringify(input);
  const normalized = text.toLowerCase();

  if (normalized.includes('enotfound') || normalized.includes('dns')) {
    return explanation('DNS failure', 'The host could not be resolved.', [
      'Check the hostname.',
      'Confirm VPN or private DNS access.',
      'Try the same URL with curl or dig.',
    ]);
  }
  if (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('etimedout')
  ) {
    return explanation('Timeout', 'The request exceeded the configured timeout.', [
      'Increase --timeout.',
      'Check whether the endpoint is slow or blocked.',
      'Verify network path and proxy settings.',
    ]);
  }
  if (normalized.includes('401')) {
    return explanation('Authentication failure', 'The API returned 401 Unauthorized.', [
      'Check bearer token or API key.',
      'Confirm token expiration.',
      'Verify the Authorization header is being sent.',
    ]);
  }
  if (normalized.includes('403')) {
    return explanation('Authorization failure', 'The API returned 403 Forbidden.', [
      'Confirm the token has the required scope.',
      'Check environment/account permissions.',
      'Verify the endpoint is enabled for this user.',
    ]);
  }
  if (
    normalized.includes('schema') ||
    normalized.includes('must have') ||
    normalized.includes('required')
  ) {
    return explanation('Schema mismatch', 'The response did not match the expected schema.', [
      'Inspect the response body.',
      'Compare the OpenAPI schema and implementation.',
      'Check for missing required fields or type changes.',
    ]);
  }
  if (normalized.includes('<html') || normalized.includes('text/html')) {
    return explanation(
      'Unexpected HTML response',
      'The endpoint returned HTML where API data was expected.',
      [
        'Check the URL path.',
        'Look for auth redirects.',
        'Verify Accept and Content-Type headers.',
      ],
    );
  }

  return explanation('Unclassified failure', 'No specific diagnosis matched the input.', [
    'Rerun with --verbose.',
    'Check status, headers, and response body.',
    'Use --json output and inspect the error field.',
  ]);
}

function explanation(category: string, message: string, nextSteps: string[]): Explanation {
  return { category, message, nextSteps };
}
