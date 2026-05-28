# @trycedar/pi-posthog

[![npm version](https://img.shields.io/npm/v/%40trycedar%2Fpi-posthog.svg)](https://www.npmjs.com/package/@trycedar/pi-posthog)
[![npm downloads](https://img.shields.io/npm/dm/%40trycedar%2Fpi-posthog.svg)](https://www.npmjs.com/package/@trycedar/pi-posthog)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![node >=22](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg)](package.json)

Pi extension for querying PostHog from the pi coding agent.

This is the complement to `@posthog/pi`: that package sends pi agent telemetry to PostHog, while this package gives pi read-only tools for asking questions of PostHog.

## Tools

- `posthog_query_hogql` — run HogQL against a project.
- `posthog_list` — list projects, dashboards, insights, feature flags, experiments, annotations, cohorts, or persons.
- `posthog_api_get` — call a read-only PostHog API `GET` path that begins with `/api/`.

It also registers `/posthog-status` to show whether required environment variables are present without printing secrets.

## Install

```bash
pi install npm:@trycedar/pi-posthog
```

Or install directly from GitHub before a release:

```bash
pi install git:github.com/trycedar0x/pi-posthog
```

Or during local development:

```bash
pi -e ../pi-posthog/src/index.ts
```

## Configuration

Set these environment variables before launching pi:

```bash
export POSTHOG_PERSONAL_API_KEY="phx_..."   # required; personal API key, not project ingestion key
export POSTHOG_PROJECT_ID="12345"           # required for project-scoped tools
export POSTHOG_HOST="https://us.posthog.com" # optional; use https://eu.posthog.com for EU Cloud
```

Optional:

```bash
export POSTHOG_MAX_RESPONSE_BYTES=40000
```

`POSTHOG_PERSONAL_API_KEY` is preferred. `POSTHOG_API_KEY` is accepted as a fallback for convenience, but a project ingestion key (`phc_...`) cannot query the PostHog API.

## Example prompts

```text
What PostHog projects can I access?
Run a HogQL query for signups in the last 7 days.
List feature flags in PostHog.
Show dashboards in my PostHog project.
GET /api/projects/123/insights/?limit=5 from PostHog.
```

## Security model

- The extension only performs `GET` API requests plus `POST /api/projects/:id/query/` for HogQL queries.
- `posthog_api_get` rejects paths that do not start with `/api/`.
- Tool output is truncated to avoid flooding the model context.
- Do not put PostHog keys in source files; pass them through environment variables.

## Development

```bash
npm install
npm test
npm run typecheck
npm run release:dry
```

## License

MIT
