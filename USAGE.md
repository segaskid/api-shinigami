# API Shinigami Usage

This document covers the current CLI surface for API Shinigami.

API Shinigami is installed from GitHub until the npm registry package is published:

```bash
npm install -g github:segaskid/api-shinigami
shinigami --version
shinigami --help
```

Local development install:

```bash
git clone https://github.com/segaskid/api-shinigami.git
cd api-shinigami
npm install
npm run build
npm link
```

Requirements: Node.js 20 or newer.

## Global Options

```bash
shinigami --json <command>
shinigami --quiet <command>
shinigami --verbose <command>
shinigami --no-color <command>
```

Use `--json` when scripting. JSON mode prints valid JSON and avoids decorative terminal output.

## Single Requests

```bash
shinigami request GET https://api.example.com/users
shinigami request GET https://api.example.com/users --query page=1 --query limit=10
shinigami request POST https://api.example.com/users --json-body '{"name":"Light"}'
shinigami request POST https://api.example.com/users --json '{"name":"Light"}'
shinigami request PUT https://api.example.com/users/1 --body ./payload.json
shinigami request DELETE https://api.example.com/users/1 --auth bearer:$TOKEN --fail
```

Request options:

- `--header <key:value>` repeatable request header
- `--query <key=value>` repeatable query parameter
- `--json-body <json>` JSON body
- `--json <json>` request-body alias when used after `request`
- `--body <path-or-string>` raw body or file path
- `--form <key=value>` form body field
- `--auth <type:value>` `bearer`, `basic`, or `api-key`
- `--timeout <ms>` timeout in milliseconds
- `--retries <number>` retry failed requests
- `--output <file>` save response body
- `--fail` exit non-zero on HTTP 4xx/5xx
- `--json-output` JSON output for this request

## Sniff Page Endpoints

```bash
shinigami sniff https://example.com
shinigami sniff https://example.com --json
shinigami sniff https://example.com --collection sniffed.collection.yml
shinigami sniff https://example.com --max-assets 50
shinigami sniff https://example.com --include-external
```

`sniff` fetches the page, scans HTML, forms, and same-origin JS/CSS assets, then reports candidate API endpoints. It extracts:

- `<form action="...">`
- `fetch('/api/...')`
- `xhr.open('GET', '/api/...')`
- API-looking string literals such as `/api/users`, `/v1/search`, `/graphql`

Static sniffing cannot see requests created only after browser interaction, login state, service workers, or runtime-only JavaScript branches.

## Collections

Run a collection:

```bash
shinigami collection run examples/basic.collection.yml --env local
shinigami collection run examples/flow.collection.yml --env local --filter login
shinigami collection run api.yml --data users.csv --reporter junit --output reports/junit.xml
```

Validate a collection:

```bash
shinigami collection validate examples/basic.collection.yml
```

Create a starter collection:

```bash
shinigami collection new "Billing API"
```

Collection format:

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
    url: '{{baseUrl}}/login'
    body:
      json:
        email: '{{email}}'
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
      properties:
        id:
          type: number
        email:
          type: string
    assertions:
      - status: 200
      - jsonPath: '$.email'
        exists: true
```

Supported collection features:

- `defaults.headers`
- `defaults.query`
- `defaults.auth`
- `environments`
- `dependsOn`
- `captures`
- `responseSchema`
- assertions
- data rows through `--data`
- targeted runs through `--filter`

## Tests

```bash
shinigami test examples/basic.collection.yml
shinigami test examples/flow.collection.yml --env local --data users.csv
shinigami test api.yml --bail
shinigami test api.yml --filter login
```

Reporter output:

```bash
shinigami test api.yml --reporter pretty
shinigami test api.yml --reporter json
shinigami test api.yml --reporter md --output reports/run.md
shinigami test api.yml --reporter html --output reports/run.html
shinigami test api.yml --reporter junit --output reports/junit.xml
```

Failed assertions exit with code `6`.

## Data Files

CSV:

```csv
email,password
light@example.com,secret
misa@example.com,secret
```

JSON:

```json
[
  { "email": "light@example.com", "password": "secret" },
  { "email": "misa@example.com", "password": "secret" }
]
```

Each row is exposed as variables for one collection iteration.

## Assertions

```yaml
assertions:
  - status: 200
  - header:
      name: Content-Type
      contains: application/json
  - jsonPath: $.data.id
    exists: true
  - jsonPath: $.data.email
    equals: light@example.com
  - jsonPath: $.data.email
    matches: '^[^@]+@[^@]+$'
  - responseTimeLessThan: 500
  - bodyContains: success
```

JSON path support is dot-path based. Examples: `$.id`, `$.data.email`, `$.users.0.id`.

## Environments

Environment file:

```yaml
name: local
variables:
  baseUrl: http://localhost:3000
secrets:
  token: env:API_TOKEN
```

Use it:

```bash
shinigami collection run api.yml --env ./local.env.yml
```

Variable precedence:

1. CLI `--var key=value`
2. Environment file variables
3. Collection environment variables
4. Process environment variables
5. Built-in variables

Built-ins:

- `{{$timestamp}}`
- `{{$uuid}}`
- `{{$randomInt}}`
- `{{$iteration}}`

## OpenAPI

Inspect:

```bash
shinigami inspect openapi openapi.yml
shinigami openapi lint openapi.yml
```

Generate a collection:

```bash
shinigami openapi generate-collection openapi.yml --output api.collection.yml
```

Diff two specs:

```bash
shinigami openapi diff old.openapi.yml new.openapi.yml
shinigami --json openapi diff old.openapi.yml new.openapi.yml
```

OpenAPI diff reports removed operations, removed success responses, and new required request fields as breaking changes.

## Import Curl

```bash
shinigami import curl "curl https://api.example.com/users"
shinigami import curl "curl -X POST https://api.example.com/users -H 'Content-Type: application/json' --data-raw '{\"name\":\"Light\"}'"
shinigami import curl "curl https://api.example.com/users" --format collection --output imported.collection.yml
```

Supported curl import fields:

- URL
- `-X`, `--request`
- `-H`, `--header`
- `-d`, `--data`, `--data-raw`, `--data-binary`

## Fuzzing

```bash
shinigami fuzz POST https://api.example.com/users --field name --dry-run
shinigami fuzz POST https://api.example.com/users --field name --cases basic,strings,numbers --limit 10
```

Only fuzz APIs you own or are authorized to test.

## Workspace

```bash
shinigami workspace init
shinigami workspace status
shinigami workspace doctor
```

Created structure:

```txt
.shinigami/
  config.yml
  environments/
  collections/
  reports/
  history/
```

## History

```bash
shinigami history list
shinigami history show <id>
shinigami history clear
```

History is redacted by default and persistence is best-effort.

## Config

```bash
shinigami config list
shinigami config get defaultTimeout
shinigami config set defaultTimeout 10000
shinigami config reset
```

## Auth Helpers

```bash
shinigami auth bearer "$TOKEN"
shinigami auth basic username password
shinigami auth api-key X-API-Key "$API_KEY" --in header
```

For requests, inline auth is usually simpler:

```bash
shinigami request GET https://api.example.com/me --auth bearer:$TOKEN
```

## Exit Codes

- `0` success
- `1` general error
- `2` invalid arguments
- `3` config error
- `4` network error
- `5` timeout
- `6` failed assertions
- `7` file error
- `8` auth error
- `9` schema or OpenAPI diff error

## Security

Secrets are redacted by default. API Shinigami redacts authorization headers, cookies, API keys, tokens, passwords, secrets, client secrets, and private keys.
