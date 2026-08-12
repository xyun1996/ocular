# MCP Registry publication

`ocular` is published in the official MCP Registry and resolves to the public npm package `ocular-mcp`.

## Live Registry identity

- MCP Registry name: `io.github.xyun1996/ocular`
- Registry version: `0.1.0`
- Registry status: `active`
- npm package: `ocular-mcp@0.1.0`
- transport: `stdio`
- source repository: `https://github.com/xyun1996/ocular`
- first Registry publication: 2026-08-12

The `v0.1.0` bootstrap publication used GitHub Actions OIDC and the official `mcp-publisher`. The Registry API returned the entry as the latest active version after publication.

The npm package contains the matching `mcpName` value in `package.json`, which the Registry uses to verify that the npm package corresponds to the `server.json` metadata.

## Configuration exposed to MCP clients

`server.json` declares the minimum provider configuration required to start ocular:

- `OCULAR_BASE_URL` — OpenAI-compatible API base URL
- `OCULAR_API_KEY` — provider API key, marked secret
- `OCULAR_MODEL` — vision-capable model identifier

Optional ocular configuration remains documented in `.env.example` and does not need to be required by Registry-based installation.

## Verify Registry discovery

The official Registry API can be queried for the server name:

```bash
curl --get \
  --data-urlencode 'search=io.github.xyun1996/ocular' \
  'https://registry.modelcontextprotocol.io/v0.1/servers'
```

A current entry should identify:

```text
name: io.github.xyun1996/ocular
version: 0.1.0
status: active
package: ocular-mcp@0.1.0
transport: stdio
```

Treat the Registry as a discovery channel rather than a package host: installation resolves through the npm package declared in `server.json`.

## Release synchronization

`npm run check` executes `scripts/check-registry-metadata.mjs`, which verifies that:

- `package.json#mcpName` equals `server.json#name`;
- package and server versions match;
- the npm package identifier matches `package.json#name`;
- the Registry transport remains `stdio`;
- required environment-variable metadata is present;
- `OCULAR_API_KEY` is marked secret.

This prevents a release from publishing npm and MCP Registry metadata with mismatched identities or versions.

## Automated publication

`.github/workflows/publish.yml` is the ongoing release path. When a normal versioned GitHub Release is published, it:

1. checks out the exact release tag;
2. verifies the tag matches `v${package.version}`;
3. runs build, tests, package-content checks, and Registry metadata checks;
4. publishes the npm version through npm Trusted Publishing when that exact version does not already exist;
5. waits for the npm artifact to become publicly visible;
6. downloads the official `mcp-publisher` CLI;
7. authenticates to the MCP Registry with GitHub Actions OIDC (`github-oidc`);
8. publishes the repository's `server.json`.

No npm write token, MCP Registry PAT, or private Registry key is stored as a long-lived repository secret for this flow.

## v0.1.0 publication record

For the first release, `ocular-mcp@0.1.0` was published before the GitHub Release so npm package ownership and Trusted Publishing could be established safely. A one-time bootstrap workflow then:

1. verified `ocular-mcp@0.1.0` on the public npm Registry;
2. authenticated to the MCP Registry with GitHub OIDC;
3. published `io.github.xyun1996/ocular` version `0.1.0`;
4. queried the Registry API and verified the entry was visible and active;
5. created the GitHub `v0.1.0` Release targeting the final release commit.

The one-time bootstrap workflow was deleted after successful completion. Future releases use the normal `publish.yml` path described above.

## Registry status and compatibility

Registry publication confirms distribution metadata and package identity; it does not prove that every OpenAI-compatible provider/model works with ocular. Provider compatibility remains separately tracked through [`provider-compatibility.md`](provider-compatibility.md) and reproducible live smoke tests.

The Registry schema and publisher may evolve over time, so release PRs should keep `server.json` and the publication workflow under review rather than treating the current schema as permanently fixed.
