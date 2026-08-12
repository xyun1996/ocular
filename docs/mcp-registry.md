# MCP Registry publication

`ocular` is prepared for discovery through the official MCP Registry after its npm package is public.

## Registry identity

- MCP Registry name: `io.github.xyun1996/ocular`
- npm package: `ocular-mcp`
- transport: `stdio`
- source repository: `https://github.com/xyun1996/ocular`

The npm package contains the matching `mcpName` value in `package.json`, which the Registry uses to verify that the npm package corresponds to the `server.json` metadata.

## Configuration exposed to MCP clients

`server.json` declares the minimum provider configuration required to start ocular:

- `OCULAR_BASE_URL` — OpenAI-compatible API base URL
- `OCULAR_API_KEY` — provider API key, marked secret
- `OCULAR_MODEL` — vision-capable model identifier

Optional ocular configuration remains documented in `.env.example` and does not need to be required by Registry-based installation.

## Release synchronization

`npm run check` executes `scripts/check-registry-metadata.mjs`, which verifies that:

- `package.json#mcpName` equals `server.json#name`;
- package and server versions match;
- the npm package identifier matches `package.json#name`;
- the Registry transport remains `stdio`;
- required environment-variable metadata is present;
- `OCULAR_API_KEY` is marked secret.

This is intended to prevent a release from publishing npm and MCP Registry metadata with mismatched identities or versions.

## Automated publication

`.github/workflows/publish.yml` runs when a GitHub Release is published. After the npm package is confirmed visible, the workflow:

1. downloads the official `mcp-publisher` CLI;
2. authenticates to the MCP Registry with GitHub Actions OIDC (`github-oidc`);
3. publishes the repository's `server.json`.

No MCP Registry PAT or private key is stored as a repository secret for the GitHub namespace flow.

## First release

The MCP Registry hosts metadata and validates the referenced package; it does not host the npm artifact itself. Therefore `ocular-mcp` must exist publicly on npm before `io.github.xyun1996/ocular` can be published successfully.

For `v0.1.0`, follow the bootstrap sequence in [`publishing.md`](publishing.md):

1. publish and verify `ocular-mcp@0.1.0` from the maintainer-controlled npm session;
2. configure npm Trusted Publishing;
3. publish the GitHub `v0.1.0` Release;
4. the release workflow skips the already-existing npm version and publishes `server.json` to the MCP Registry using GitHub OIDC.

## Verify Registry discovery

After a successful Registry publish, search the official Registry for:

```text
io.github.xyun1996/ocular
```

Treat the Registry as a discovery channel rather than a package host: installation still resolves through the npm package declared in `server.json`.

## Registry status

The official MCP Registry is currently a preview service. Metadata/schema behavior may evolve, so release PRs should keep the `server.json` schema and publisher workflow under review rather than assuming they are permanently stable.
