# API Shinigami

API Shinigami is a CLI-first API testing, debugging, automation, and inspection toolkit for developers who live in the terminal.

It combines single-request ergonomics with repeatable YAML collections, assertions, environment variables, safe secret redaction, and CI-friendly exit codes.

This repository contains the first production-oriented MVP: single requests, collection runs, assertions, OpenAPI inspection, basic fuzzing, history/report storage, and typed core modules.

## Install

```bash
npm install -g api-shinigami
shinigami --help
```

For local development:

```bash
npm install
npm run build
npm link
```

## Quick Start

```bash
shinigami request GET https://jsonplaceholder.typicode.com/posts/1
shinigami request POST https://httpbin.org/post --json-body '{"hello":"world"}'
shinigami request GET https://api.example.com/users --header "Authorization: Bearer $TOKEN"
```

Machine-readable output:

```bash
shinigami --json request GET https://api.example.com/users
```

## Requests

```bash
shinigami request GET https://api.example.com/users --query page=1 --query limit=10
shinigami request POST https://api.example.com/users --json-body '{"name":"Ryuk"}'
shinigami request PUT https://api.example.com/users/1 --body ./payload.json
shinigami request DELETE https://api.example.com/users/1 --auth bearer:$TOKEN --fail
```

Supported request options include headers, query params, inline JSON, raw body input, form fields, auth helpers, timeouts, retries, response file output, and JSON output.

`--json-body` is the explicit JSON request-body flag. For curl-style ergonomics, `shinigami request ... --json '{"key":"value"}'` is also accepted when `--json` appears after `request`. Use global `shinigami --json ...` for machine-readable command output.

## Collections

Collections are YAML-first plain files:

```yaml
name: Demo API
version: 1
environments:
  local:
    baseUrl: 'http://localhost:3000'
requests:
  - id: get-users
    name: Get users
    method: GET
    url: '{{baseUrl}}/users'
    assertions:
      - status: 200
      - jsonPath: '$.users'
        exists: true
```

Run one:

```bash
shinigami collection run examples/basic.collection.yml --env local
```

## Environments

```yaml
name: local
variables:
  baseUrl: http://localhost:3000
secrets:
  token: env:API_TOKEN
```

Variables resolve with this precedence: CLI `--var`, environment files, collection environments, process environment variables, then built-in dynamic variables such as `{{$timestamp}}`, `{{$uuid}}`, and `{{$randomInt}}`.

## Assertions

MVP assertions include:

```yaml
assertions:
  - status: 200
  - header:
      name: Content-Type
      contains: application/json
  - jsonPath: $.data.id
    exists: true
  - jsonPath: $.data.email
    matches: '^[^@]+@[^@]+$'
  - responseTimeLessThan: 500
  - bodyContains: success
```

`shinigami test <file>` uses the same collection format and exits with code `6` when assertions fail.

## Security

Secrets are redacted by default in output and history. API Shinigami redacts authorization headers, cookies, API keys, tokens, passwords, secrets, client secrets, and private keys.

## CI Usage

```bash
npm ci
npm run check
shinigami --json test ./api.collection.yml --env ci
```

Stable exit codes:

- `0` success
- `2` invalid CLI usage
- `4` network error
- `5` timeout
- `6` failed assertions
- `7` file errors
- `8` auth errors
- `9` schema errors

## Current Limits

- OAuth helpers, cookie jars, multipart uploads, parallel collection runs, WebSocket testing, and GraphQL testing are not part of this MVP.
- JSONPath support is intentionally simple dot-path access, for example `$.data.id` and `$.users.0.id`.
- History and report persistence are best-effort. API execution still succeeds if the local app-data directory is unavailable.

## Roadmap

- HTML and JUnit reports
- OpenAPI import to collections
- OAuth helpers
- Cookie jar
- Parallel collection runs
- Watch mode
- Plugin system
- GraphQL and WebSocket testing
