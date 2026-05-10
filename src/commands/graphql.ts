import { Command } from 'commander';
import { buildRequest } from '../core/requestBuilder.js';
import { sendHttpRequest } from '../core/httpClient.js';
import { formatResponseHuman, toResponseJson } from '../core/responseFormatter.js';
import { printJson, type GlobalOutputOptions } from '../core/output.js';
import { readTextFile } from '../utils/fs.js';
import { parseJson } from '../utils/json.js';

const INTROSPECTION_QUERY = `query IntrospectionQuery { __schema { queryType { name } mutationType { name } types { name kind } } }`;

export function createGraphqlCommand(globalOptions: () => GlobalOutputOptions): Command {
  const command = new Command('graphql').description('Run GraphQL queries and introspection');

  command
    .command('query')
    .argument('<url>')
    .option('--query <query>', 'inline GraphQL query')
    .option('--file <file>', 'GraphQL query file')
    .option('--variables <json>', 'GraphQL variables JSON')
    .action(async (url: string, options: { query?: string; file?: string; variables?: string }) => {
      const query = options.file ? await readTextFile(options.file) : options.query;
      const request = await buildRequest({
        method: 'POST',
        url,
        json: {
          query,
          variables: options.variables ? parseJson(options.variables, '--variables') : {},
        },
      });
      const response = await sendHttpRequest(request);
      if (globalOptions().json) printJson(toResponseJson(request, response));
      else process.stdout.write(formatResponseHuman(request, response));
    });

  command
    .command('introspect')
    .argument('<url>')
    .action(async (url: string) => {
      const request = await buildRequest({
        method: 'POST',
        url,
        json: { query: INTROSPECTION_QUERY },
      });
      const response = await sendHttpRequest(request);
      if (globalOptions().json) printJson(toResponseJson(request, response));
      else process.stdout.write(formatResponseHuman(request, response));
    });

  return command;
}
