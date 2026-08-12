# Reproducible visual workflow fixtures

This directory contains small synthetic PNG fixtures for exercising `ocular`'s core visual workflows with the same inputs across providers, models, and dates.

## Scope

The fixtures are project-generated and do not contain external screenshots, third-party datasets, private user data, API credentials, or copyrighted UI assets. They are distributed with the repository under the MIT license.

This suite is intended to make project-level measurements reproducible. It is **not** a broad model leaderboard and should not be used to claim that one model is generally better than another.

## Fixtures

See [`manifest.json`](manifest.json) for dimensions, SHA-256 values, descriptions, and visible facts.

| Fixture | Primary workflow |
|---|---|
| `terminal-error.png` | `diagnose_error_screenshot` |
| `ui-reference.png` | `analyze_ui_screenshot` |
| `ui-actual.png` | `analyze_ui_screenshot` |
| `ui-reference.png` + `ui-actual.png` | `compare_ui_screenshots` |
| `table.png` | `extract_table_from_image` |
| `chart.png` | `analyze_chart_image` |

The `visible_facts` entries in the manifest document what was intentionally drawn into each fixture. The initial runner does not score model prose against those strings; they are there for transparent human review and future semantic assertions.

## Run the suite

Configure an OpenAI-compatible vision endpoint using the same environment variables as the application:

```bash
export OCULAR_BASE_URL="https://your-endpoint/v1"
export OCULAR_API_KEY="your-api-key"
export OCULAR_MODEL="your-vision-model"
export OCULAR_BENCH_LABEL="provider-or-deployment-name"

npm run bench:fixtures
```

The runner:

1. builds the project;
2. verifies every fixture SHA-256 against the manifest;
3. creates the normal project provider through `createOcularProvider`;
4. calls the real tool implementations;
5. parses the MCP text response as JSON;
6. verifies each tool's documented field set;
7. records duration and environment metadata;
8. prints one machine-readable JSON result to stdout.

API keys are never included in the result. The base URL is sanitized to remove credentials, query parameters, and fragments; still review results before publishing if the hostname/path is private.

## Cold vs cache-hit timing

By default the runner disables ocular's result cache so each duration represents a provider roundtrip.

To exercise the cache path as well:

```bash
OCULAR_BENCH_CACHE=true npm run bench:fixtures
```

With cache enabled, each case runs twice with identical inputs/options. The output records both durations. The second invocation is expected to exercise the cache if the first invocation completed successfully.

For clean cache measurements, point `OCULAR_CACHE_DIR` at a fresh directory or remove the previous benchmark cache before the run.

## Publishing measurements

When recording a result, include at minimum:

- test date/time;
- provider/deployment label;
- sanitized endpoint style;
- exact model identifier;
- Node.js version;
- fixture manifest version;
- whether ocular caching was enabled;
- per-case durations and structural pass/fail status.

Do not publish private endpoint hostnames, API keys, auth headers, or model output containing confidential information.

## Interpreting results

A structural pass means the provider/model successfully completed the real ocular workflow and returned parseable JSON with the documented fields. It does **not** prove factual correctness of every visual observation.

Future iterations may add transparent content-level assertions against the synthetic fixture facts, but those assertions should remain narrow, explainable, and reproducible rather than turning the suite into a subjective model ranking.
