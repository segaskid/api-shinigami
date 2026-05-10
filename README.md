# API Shinigami

API Shinigami is a CLI-first API testing, debugging, automation, and inspection toolkit for developers who live in the terminal.

It combines single-request ergonomics with repeatable YAML collections, assertions, environment variables, safe secret redaction, and CI-friendly exit codes.

This repository contains a production-oriented CLI MVP: single requests, workspace files, collection runs, chained API flows, captures, assertions, data-driven test runs, OpenAPI inspection/generation, basic fuzzing, history/report storage, and typed core modules.

## Install

API Shinigami is not published to the npm registry yet. Install it directly from GitHub:

```bash
npm install -g github:segaskid/api-shinigami
shinigami --help
```

For local development, clone the repository and link the CLI:

```bash
git clone https://github.com/segaskid/api-shinigami.git
cd api-shinigami
npm install
npm run build
npm link
shinigami --help
```

Verify the installed binary:

```bash
shinigami --version
shinigami --help
```

Requirements: Node.js 20 or newer.

## Quick Start

```bash
shinigami workspace init
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

Collections are YAML-first plain files. They support defaults, environments, dependencies, captures, response schemas, and assertions:

```yaml
name: Demo API
version: 1
defaults:
  headers:
    Accept: application/json
environments:
  local:
    baseUrl: 'http://localhost:3000'
requests:
  - id: login
    name: Login
    method: POST
    url: '{{baseUrl}}/auth/login'
    body:
      json:
        email: '{{email}}'
        password: '{{password}}'
    captures:
      token:
        jsonPath: '$.accessToken'
        secret: true
    assertions:
      - status: 200

  - id: me
    name: Current user
    dependsOn: login
    method: GET
    url: '{{baseUrl}}/me'
    headers:
      Authorization: 'Bearer {{token}}'
    responseSchema:
      type: object
      required: [id, email]
    assertions:
      - status: 200
      - jsonPath: '$.email'
        exists: true
```

Run one:

```bash
shinigami collection run examples/basic.collection.yml --env local
shinigami collection run examples/flow.collection.yml --env local --filter login
```

## Data-Driven Runs

Run the same collection once per row in a CSV or JSON file:

```bash
shinigami test examples/flow.collection.yml --env local --data users.csv
```

Each row is exposed as variables, so a CSV column named `email` can be referenced as `{{email}}`.

## Reports

Collection and test runs can write machine-friendly or shareable reports:

```bash
shinigami test examples/basic.collection.yml --reporter junit --output reports/junit.xml
shinigami test examples/basic.collection.yml --reporter html --output reports/run.html
shinigami test examples/basic.collection.yml --reporter md --output reports/run.md
```

Supported reporters: `pretty`, `json`, `md`, `html`, `junit`.

## Import Curl

Convert a curl command into a Shinigami request:

```bash
shinigami import curl "curl -X POST https://api.example.com/users -H 'Content-Type: application/json' --data-raw '{\"name\":\"Light\"}'"
```

Generate a collection from a curl command:

```bash
shinigami import curl "curl https://api.example.com/users" --format collection --output imported.collection.yml
```

Supported curl import fields: URL, `-X/--request`, `-H/--header`, `-d/--data`, `--data-raw`, and `--data-binary`.

## OpenAPI

Inspect an OpenAPI document:

```bash
shinigami openapi lint examples/openapi-example.json
```

Generate a starter collection:

```bash
shinigami openapi generate-collection examples/openapi-example.json --output generated.collection.yml
```

## Workspace

Create local project structure:

```bash
shinigami workspace init
shinigami workspace status
shinigami workspace doctor
```

This creates `.shinigami/` with config, environment, collection, report, and history folders.

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
- Curl import supports common request flags, not every curl transport option.
- History and report persistence are best-effort. API execution still succeeds if the local app-data directory is unavailable.

## Roadmap

- OpenAPI import to collections
- OAuth helpers
- Cookie jar
- Parallel collection runs
- Watch mode
- Plugin system
- GraphQL and WebSocket testing
