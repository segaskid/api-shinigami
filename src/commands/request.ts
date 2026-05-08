import { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import { ExitCode } from '../core/exitCodes.js';
import { ShinigamiError } from '../core/errors.js';
import { buildRequest } from '../core/requestBuilder.js';
import { sendHttpRequest } from '../core/httpClient.js';
import { formatResponseHuman, toResponseJson } from '../core/responseFormatter.js';
import { parseInlineAuth } from '../core/authManager.js';
import { addHistoryEntry } from '../core/historyStore.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';
import { parseJson } from '../utils/json.js';
import { parseHeader } from '../utils/headers.js';
import { writeTextFile } from '../utils/fs.js';

interface RequestOptions {
  header?: string[];
  query?: string[];
  jsonBody?: string;
  body?: string;
  form?: string[];
  auth?: string;
  timeout?: string;
  retries?: string;
  followRedirects?: boolean;
  output?: string;
  fail?: boolean;
  jsonOutput?: boolean;
}

export function createRequestCommand(globalOptions: () => GlobalOutputOptions): Command {
  return new Command('request')
    .description('Send a single HTTP request')
    .argument('<method>', 'HTTP method')
    .argument('<url>', 'absolute request URL')
    .option('--header <key:value>', 'add request header', collect, [])
    .option('--query <key=value>', 'add query parameter', collect, [])
    .option('--json-body <json>', 'send JSON body')
    .option('--body <path-or-string>', 'send raw body from file path or string')
    .option('--form <key=value>', 'send form field', collect, [])
    .option('--auth <type:value>', 'apply bearer, basic, or api-key auth')
    .option('--timeout <ms>', 'request timeout in milliseconds')
    .option('--retries <number>', 'retry failed requests')
    .option('--follow-redirects', 'follow redirects')
    .option('--no-follow-redirects', 'do not follow redirects')
    .option('--output <file>', 'save response body to file')
    .option('--fail', 'exit non-zero on HTTP 4xx/5xx')
    .option('--json-output', 'print structured machine-readable output')
    .addHelpText(
      'after',
      '\nAlias:\n  --json <json>            send JSON body when used after "request"\n',
    )
    .action(async (method: string, url: string, options: RequestOptions) => {
      const merged = {
        ...globalOptions(),
        ...options,
        json: globalOptions().json || options.jsonOutput,
      };
      const headers = Object.fromEntries((options.header ?? []).map(parseHeader));
      const query = Object.fromEntries((options.query ?? []).map(parsePair));
      const form = Object.fromEntries((options.form ?? []).map(parsePair));
      const request = await buildRequest({
        method,
        url,
        headers,
        query,
        json: options.jsonBody !== undefined ? parseJson(options.jsonBody, '--json') : undefined,
        body: options.body,
        form: Object.keys(form).length ? form : undefined,
        auth: options.auth ? parseInlineAuth(options.auth) : undefined,
        timeoutMs: options.timeout ? Number(options.timeout) : undefined,
        retries: options.retries ? Number(options.retries) : undefined,
        followRedirects: options.followRedirects,
      });
      const response = await sendHttpRequest(request);
      if (options.output) {
        await writeTextFile(options.output, response.bodyText);
      }
      await addHistoryEntry({
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        kind: 'request',
        data: toResponseJson(request, response),
      });
      if (merged.json) {
        printJson(toResponseJson(request, response));
      } else if (!merged.quiet) {
        process.stdout.write(formatResponseHuman(request, response));
      }
      if (options.fail && response.status >= 400) {
        throw new ShinigamiError({
          code: 'HTTP_STATUS_FAILURE',
          message: `HTTP request returned ${response.status}.`,
          exitCode: ExitCode.GeneralError,
        });
      }
    });
}

function collect(value: string, previous: string[]): string[] {
  previous.push(value);
  return previous;
}

function parsePair(input: string): [string, string] {
  const index = input.indexOf('=');
  if (index <= 0) {
    throw new ShinigamiError({
      code: 'INVALID_PAIR',
      message: `Invalid key/value pair "${input}".`,
      hint: 'Use key=value.',
      exitCode: ExitCode.InvalidArguments,
    });
  }
  return [input.slice(0, index), input.slice(index + 1)];
}
